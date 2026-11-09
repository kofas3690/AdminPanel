"""Hardware information: the machine, CPU, memory, disks, PCI and USB devices, temperatures.

Everything here only reads. Most of it comes from the kernel (/sys, /proc) and the standard listing
tools (lscpu, lsblk, lspci, lsusb). The memory *modules* (size, type and speed of each stick) are only
known to the firmware and need root, so that one call goes through a sudo rule that names exactly
`dmidecode -t memory`. When a tool is missing the section says so and how to install it.
"""
import json, os, re, shlex, subprocess
from pathlib import Path
import psutil
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api/hardware")
DMI = Path("/sys/class/dmi/id")
ENV = {**os.environ, "LC_ALL": "C", "LANG": "C"}
PACKAGE_OF = {"lspci": "pciutils", "lsusb": "usbutils", "lscpu": "util-linux", "lsblk": "util-linux",
              "dmidecode": "dmidecode"}


def run(cmd, timeout=10):
    """Run a command (no shell). Returns (stdout, None) or (None, short reason)."""
    try:
        r = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except FileNotFoundError:
        return None, "missing"
    except subprocess.TimeoutExpired:
        return None, "timed out"
    if r.returncode != 0:
        return None, (r.stderr or "failed").strip().splitlines()[-1][:160] if (r.stderr or "").strip() else "failed"
    return r.stdout, None


def note(tool, why):
    if why == "missing":
        return f"{tool} is not installed (sudo apt install {PACKAGE_OF.get(tool, tool)})"
    return f"{tool}: {why}"


def read(path):
    try:
        return Path(path).read_text(errors="replace").strip()
    except OSError:
        return ""


def machine():
    rows = []
    for label, f in [("Vendor", "sys_vendor"), ("Model", "product_name"), ("Version", "product_version"),
                     ("Board", "board_name"), ("Firmware", "bios_vendor"), ("Firmware version", "bios_version"),
                     ("Firmware date", "bios_date")]:
        v = read(DMI / f)
        if v and v.lower() not in ("none", "to be filled by o.e.m.", "default string"):
            rows.append([label, v])
    out, _ = run(["systemd-detect-virt"])
    virt = (out or "").strip()
    rows.append(["Virtualization", virt if virt and virt != "none" else "none (physical machine)"])
    return rows


def cpu():
    out, why = run(["lscpu", "-J"])
    want = ["Model name", "Vendor ID", "Architecture", "Socket(s)", "Core(s) per socket", "Thread(s) per core",
            "CPU(s)", "CPU max MHz", "CPU min MHz", "L1d cache", "L2 cache", "L3 cache", "Virtualization"]
    rows = []
    if out:
        try:
            d = {e["field"].rstrip(":"): e["data"] for e in json.loads(out)["lscpu"]}
            rows = [[k, d[k]] for k in want if d.get(k)]
        except (ValueError, KeyError):
            pass
    if not rows:
        info = read("/proc/cpuinfo")
        m = re.search(r"model name\s*:\s*(.+)", info)
        rows = [["Model name", m.group(1)] if m else ["Model name", "unknown"], ["CPU(s)", str(psutil.cpu_count())]]
    return {"rows": rows, "note": note("lscpu", why) if why == "missing" else ""}


def memory():
    vm, sw = psutil.virtual_memory(), psutil.swap_memory()
    res = {"total": vm.total, "available": vm.available, "swap": sw.total, "modules": [], "note": ""}
    out, why = run(["sudo", "-n", "/usr/sbin/dmidecode", "-t", "memory"], timeout=15)
    if out is None:
        if why == "missing":
            res["note"] = "dmidecode is not installed (sudo apt install dmidecode), so the memory modules cannot be listed."
        elif "password" in (why or "") or "not allowed" in (why or "") or "may not run" in (why or ""):
            res["note"] = "Memory module details need a sudo rule that is installed with the package. Upgrade or reinstall the adminpanel package."
        elif "No SMBIOS" in (why or "") or "DMI" in (why or ""):
            res["note"] = "The firmware does not list memory modules (normal on virtual machines)."
        else:
            res["note"] = "Memory module details are not available here (" + (why or "no access") + ")."
        return res
    for block in out.split("\n\n"):
        if "\nMemory Device" not in "\n" + block:
            continue
        f = dict(m.groups() for m in re.finditer(r"^\s+([A-Za-z ]+?):\s*(.*)$", block, re.M))
        size = f.get("Size", "")
        if not size or size.startswith("No Module"):
            continue
        clean = lambda v: "" if (v or "").lower() in ("unknown", "not specified", "[empty]", "none") else v
        res["modules"].append({"slot": f.get("Locator", ""), "size": size, "type": clean(f.get("Type")),
                               "speed": clean(f.get("Configured Memory Speed") or f.get("Speed")),
                               "maker": clean(f.get("Manufacturer")), "form": clean(f.get("Form Factor"))})
    if not res["modules"]:
        res["note"] = "The firmware does not list memory modules (normal on virtual machines)."
    return res


def disks():
    cols = "NAME,TYPE,SIZE,MODEL,ROTA,TRAN,FSTYPE,MOUNTPOINTS,RO"
    out, why = run(["lsblk", "-J", "-b", "-o", cols])
    if out is None and why not in ("missing", "timed out"):
        out, why = run(["lsblk", "-J", "-b", "-o", cols.replace("MOUNTPOINTS", "MOUNTPOINT")])
    if out is None:
        return {"rows": [], "note": note("lsblk", why)}
    rows = []

    def walk(devs, depth):
        for d in devs:
            if d.get("type") in ("loop", "ram", "rom") and depth == 0:
                continue
            mp = d.get("mountpoints") or d.get("mountpoint") or []
            mp = [m for m in (mp if isinstance(mp, list) else [mp]) if m]
            kind = d.get("type") or ""
            if depth == 0 and kind == "disk":
                kind = "SSD/flash" if str(d.get("rota")) in ("0", "False", "false") else "hard disk"
            rows.append({"name": d.get("name") or "", "depth": depth, "type": kind, "size": int(d.get("size") or 0),
                         "model": (d.get("model") or "").strip(), "bus": d.get("tran") or "",
                         "fs": d.get("fstype") or "", "mounts": mp, "ro": bool(d.get("ro")) and str(d.get("ro")) not in ("0", "false", "False")})
            walk(d.get("children") or [], depth + 1)
    try:
        walk(json.loads(out)["blockdevices"], 0)
    except (ValueError, KeyError):
        return {"rows": [], "note": "lsblk gave output that could not be read"}
    return {"rows": rows, "note": ""}


def pci():
    out, why = run(["lspci", "-mm"])
    if out is None:
        return {"rows": [], "note": note("lspci", why) if why else ""}
    rows = []
    for line in out.splitlines()[:300]:
        try:
            p = shlex.split(line)
        except ValueError:
            continue
        if len(p) >= 4:
            rows.append({"slot": p[0], "class": p[1], "vendor": p[2], "device": p[3]})
    return {"rows": rows, "note": ""}


def usb():
    out, why = run(["lsusb"])
    if out is None:
        return {"rows": [], "note": note("lsusb", why) if why else ""}
    rows = []
    for line in out.splitlines()[:200]:
        m = re.match(r"Bus (\d+) Device (\d+): ID ([0-9a-f]{4}:[0-9a-f]{4})\s*(.*)", line)
        if m:
            rows.append({"bus": m.group(1), "device": m.group(2), "id": m.group(3), "name": m.group(4) or "(unnamed)"})
    return {"rows": rows, "note": ""}


def sensors():
    temps = []
    try:
        for chip, entries in sorted(psutil.sensors_temperatures().items()):
            for e in entries:
                temps.append({"chip": chip, "label": e.label or "", "value": round(e.current, 1),
                              "high": e.high, "critical": e.critical})
    except (AttributeError, OSError):
        pass
    fans = []
    try:
        for chip, entries in sorted(psutil.sensors_fans().items()):
            for e in entries:
                fans.append({"chip": chip, "label": e.label or "", "rpm": e.current})
    except (AttributeError, OSError):
        pass
    bat = None
    try:
        b = psutil.sensors_battery()
        if b:
            bat = {"percent": round(b.percent), "plugged": bool(b.power_plugged)}
    except (AttributeError, OSError):
        pass
    return {"temps": temps, "fans": fans, "battery": bat}


@router.get("")
def everything(user: str = Depends(current_user)):
    return {"machine": machine(), "cpu": cpu(), "memory": memory(), "disks": disks(), "pci": pci(), "usb": usb(),
            "sensors": sensors()}


@router.get("/sensors")
def live_sensors(user: str = Depends(current_user)):
    return sensors()
