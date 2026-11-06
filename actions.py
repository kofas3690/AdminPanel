"""Actions that change or read this machine, written so that both the panel and `bridge.py` can call them.

Standard library only. Nothing here knows about web requests or about SSH; it takes plain values,
checks them, and either returns a result or raises ActionError(status, message).
"""
import os, shutil, subprocess

SYSTEMCTL = "/usr/bin/systemctl"
JOURNALCTL = "/usr/bin/journalctl"
MAX_LOG_LINES = 500
MAX_LOG_BYTES = 200 * 1024

ALLOWED = {
    "nginx": ["start", "stop", "restart"],
    "cron": ["start", "stop", "restart"],
    "ssh": ["restart"],
}


class ActionError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def _run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=30)


def list_services():
    result = []
    for name, actions in ALLOWED.items():
        r = _run([SYSTEMCTL, "show", f"{name}.service",
                  "--property=LoadState,ActiveState,SubState,Description"])
        props = dict(l.split("=", 1) for l in r.stdout.splitlines() if "=" in l)
        if props.get("LoadState") == "not-found":
            result.append({"name": name, "state": "not installed", "description": "", "actions": []})
        else:
            result.append({
                "name": name,
                "state": f'{props.get("ActiveState")}/{props.get("SubState")}',
                "description": props.get("Description", ""),
                "actions": actions,
            })
    return result


def act_service(name, action):
    """Starts, stops or restarts one of the allowed services. Returns True, or raises ActionError."""
    if not isinstance(name, str) or not isinstance(action, str) or action not in ALLOWED.get(name, []):
        raise ActionError(403, "Not allowed")
    r = _run(["sudo", "-n", SYSTEMCTL, action, name])
    if r.returncode != 0:
        raise ActionError(500, r.stderr.strip() or "Command failed")
    return True


def _meminfo():
    out = {}
    with open("/proc/meminfo") as f:
        for line in f:
            k, _, v = line.partition(":")
            if k in ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree"):
                out[k] = int(v.split()[0]) * 1024
    return out


def system_info():
    """Read-only facts about this machine, for the Remote services page."""
    osname = ""
    try:
        for line in open("/etc/os-release"):
            if line.startswith("PRETTY_NAME="):
                osname = line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    try:
        uptime = int(float(open("/proc/uptime").read().split()[0]))
    except (OSError, ValueError, IndexError):
        uptime = None
    try:
        m = _meminfo()
    except (OSError, ValueError):
        m = {}
    d = shutil.disk_usage("/")
    u = os.uname()
    return {"hostname": u.nodename[:100], "os": osname[:100], "kernel": u.release[:100], "uptime": uptime,
            "load": [round(x, 2) for x in os.getloadavg()], "cpus": os.cpu_count(),
            "mem_total": m.get("MemTotal"), "mem_available": m.get("MemAvailable"),
            "disk_total": d.total, "disk_used": d.used}


def service_logs(name, lines):
    """The last lines of the journal of one allowed service."""
    if not isinstance(name, str) or name not in ALLOWED:
        raise ActionError(403, "Not allowed")
    if not isinstance(lines, int) or isinstance(lines, bool) or not 1 <= lines <= MAX_LOG_LINES:
        raise ActionError(400, f"lines must be a number from 1 to {MAX_LOG_LINES}")
    r = _run([JOURNALCTL, "-u", f"{name}.service", "-n", str(lines), "--no-pager", "-o", "short-iso", "-q"])
    if r.returncode != 0:
        raise ActionError(500, "Could not read the journal on that machine")
    text = r.stdout
    if len(text.encode("utf-8", "replace")) > MAX_LOG_BYTES:
        text = text.encode("utf-8", "replace")[-MAX_LOG_BYTES:].decode("utf-8", "replace")
    return text
