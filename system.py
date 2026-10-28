import os, platform, socket, time
from pathlib import Path
import psutil
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api")

psutil.cpu_percent(interval=None)   # prime the counter so later readings are meaningful


def os_name():
    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            if line.startswith("PRETTY_NAME="):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return platform.system()


def cpu_model():
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.lower().startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or ""


@router.get("/system")
def system(user: str = Depends(current_user)):
    vm, sw, du = psutil.virtual_memory(), psutil.swap_memory(), psutil.disk_usage("/")
    rx = tx = 0
    for name, c in psutil.net_io_counters(pernic=True).items():
        if name != "lo":
            rx += c.bytes_recv
            tx += c.bytes_sent
    ips = [{"iface": name, "addr": a.address}
           for name, addrs in psutil.net_if_addrs().items() if name != "lo"
           for a in addrs if a.family == socket.AF_INET]
    return {
        "hostname": socket.gethostname(),
        "os": os_name(),
        "kernel": platform.release(),
        "arch": platform.machine(),
        "cpu_model": cpu_model(),
        "cpu_cores": psutil.cpu_count(logical=True),
        "cpu_percent": psutil.cpu_percent(interval=None),
        "load": list(os.getloadavg()),
        "mem": {"total": vm.total, "used": vm.total - vm.available, "percent": vm.percent},
        "swap": {"total": sw.total, "used": sw.used, "percent": sw.percent},
        "disk": {"total": du.total, "used": du.used, "percent": du.percent},
        "net": {"rx": rx, "tx": tx},
        "uptime": int(time.time() - psutil.boot_time()),
        "time": time.time(),
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "ips": ips,
        "users": len(psutil.users()),
        "reboot_required": Path("/run/reboot-required").exists(),
        "panel_user": user,
    }
