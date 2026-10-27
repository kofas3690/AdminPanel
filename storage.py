import json, os, subprocess
import psutil
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api/storage")

LSBLK = "/usr/bin/lsblk"
ENV = {"PATH": "/usr/bin:/bin", "LC_ALL": "C"}
SKIP_FS = {"squashfs", "tmpfs", "devtmpfs", "overlay"}
FIELDS = "NAME,TYPE,SIZE,FSTYPE,MOUNTPOINTS,MODEL,RM,RO"


def truthy(v):
    return v in (True, 1, "1", "true")


def flatten(nodes, depth=0, out=None):
    out = [] if out is None else out
    for n in nodes:
        out.append({
            "name": n.get("name"),
            "type": n.get("type"),
            "size": int(n.get("size") or 0),
            "fstype": n.get("fstype") or "",
            "model": (n.get("model") or "").strip(),
            "mounts": [m for m in (n.get("mountpoints") or []) if m],
            "removable": truthy(n.get("rm")),
            "readonly": truthy(n.get("ro")),
            "depth": depth,
        })
        flatten(n.get("children") or [], depth + 1, out)
    return out


@router.get("")
def overview(user: str = Depends(current_user)):
    mounts = []
    for p in psutil.disk_partitions(all=False):
        if p.fstype in SKIP_FS or p.mountpoint.startswith("/snap/"):
            continue
        try:
            u = psutil.disk_usage(p.mountpoint)
            v = os.statvfs(p.mountpoint)
        except OSError:
            continue
        mounts.append({
            "device": p.device, "mount": p.mountpoint, "fstype": p.fstype,
            "readonly": "ro" in p.opts.split(","),
            "total": u.total, "used": u.used, "free": u.free, "percent": u.percent,
            "inodes_total": v.f_files, "inodes_free": v.f_ffree,
        })

    devices = []
    try:
        r = subprocess.run([LSBLK, "-e", "1,7", "-J", "-b", "-o", FIELDS],
                           capture_output=True, text=True, timeout=15, env=ENV)
        if r.returncode == 0:
            devices = flatten(json.loads(r.stdout).get("blockdevices", []))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass

    sw = psutil.swap_memory()
    return {
        "mounts": mounts,
        "devices": devices,
        "swap": {"total": sw.total, "used": sw.used, "percent": sw.percent},
    }
