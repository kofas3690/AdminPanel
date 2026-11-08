"""Warnings for the administrator: a disk that is filling up, memory running out, failed services.

Nothing here changes the machine. Each request looks at the machine as it is now and returns the
problems it finds, so the list is always current and there is no separate alert history to go stale.
The only stored thing is the settings (thresholds and the services the person chose to mute).
"""
import json
import psutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import current_user
from audit import audit
from store import PersistentDict
import units

router = APIRouter(prefix="/api/alerts")
store = PersistentDict("alert_settings")

DEFAULTS = {"disk_warn": 85, "disk_crit": 95, "mem_warn": 90, "muted": []}
SKIP_FS = {"squashfs", "tmpfs", "devtmpfs", "overlay", "iso9660", "ramfs"}
ORDER = {"critical": 0, "warning": 1}


def settings():
    s = dict(DEFAULTS)
    s.update(store.get("cfg") or {})
    return s


def disk_alerts(cfg):
    out, seen = [], set()
    for p in psutil.disk_partitions(all=False):
        if p.fstype in SKIP_FS or p.device in seen or p.mountpoint.startswith(("/snap", "/boot/efi")):
            continue
        seen.add(p.device)
        try:
            u = psutil.disk_usage(p.mountpoint)
        except OSError:
            continue
        sev = "critical" if u.percent >= cfg["disk_crit"] else "warning" if u.percent >= cfg["disk_warn"] else None
        if sev:
            out.append({"id": "disk:" + p.mountpoint, "severity": sev, "kind": "disk",
                        "title": f"{p.mountpoint} is {u.percent:.0f}% full",
                        "detail": f"{(u.total - u.used) / 1e9:.1f} GB free of {u.total / 1e9:.1f} GB on {p.device}.",
                        "link": "/storage.html"})
    return out


def memory_alerts(cfg):
    m = psutil.virtual_memory()
    if m.percent < cfg["mem_warn"]:
        return []
    return [{"id": "memory", "severity": "warning", "kind": "memory",
             "title": f"Memory is {m.percent:.0f}% used",
             "detail": f"{m.available / 1e6:.0f} MB available of {m.total / 1e6:.0f} MB.",
             "link": "/units.html"}]


def failed_alerts(cfg):
    try:
        r = units.sc("--failed", "--no-pager", "--plain", "--output=json")
        rows = json.loads(r.stdout or "[]") if r.returncode == 0 else []
    except (HTTPException, ValueError):
        rows = []
    out = []
    for u in rows:
        name = u.get("unit") or ""
        if not units.UNIT_RE.fullmatch(name):
            continue
        out.append({"id": "unit:" + name, "severity": "critical" if name.endswith(".service") else "warning",
                    "kind": "unit", "unit": name, "muted": name in cfg["muted"],
                    "title": f"{name} has failed",
                    "detail": (u.get("description") or "") + (" (" + u["sub"] + ")" if u.get("sub") else ""),
                    "link": "/units.html"})
    return out


@router.get("")
def current(user: str = Depends(current_user)):
    cfg = settings()
    found = disk_alerts(cfg) + memory_alerts(cfg) + failed_alerts(cfg)
    active = [a for a in found if not a.get("muted")]
    active.sort(key=lambda a: (ORDER[a["severity"]], a["title"]))
    muted = [a for a in found if a.get("muted")]
    return {"alerts": active, "muted_active": muted, "settings": cfg,
            "critical": sum(a["severity"] == "critical" for a in active),
            "warning": sum(a["severity"] == "warning" for a in active)}


class Body(BaseModel):
    disk_warn: int
    disk_crit: int
    mem_warn: int
    muted: List[str] = []


@router.put("/settings")
def save(body: Body, request: Request, user: str = Depends(current_user)):
    if not (50 <= body.disk_warn <= 99) or not (51 <= body.disk_crit <= 100) or body.disk_warn >= body.disk_crit:
        raise HTTPException(400, "Disk: warning must be 50 to 99 and lower than critical (up to 100)")
    if not (50 <= body.mem_warn <= 100):
        raise HTTPException(400, "Memory warning must be between 50 and 100")
    muted = sorted({u for u in body.muted if units.UNIT_RE.fullmatch(u)})
    if len(muted) != len(set(body.muted)) or len(muted) > 100:
        raise HTTPException(400, "Invalid service name in the muted list")
    cfg = {"disk_warn": body.disk_warn, "disk_crit": body.disk_crit, "mem_warn": body.mem_warn, "muted": muted}
    store["cfg"] = cfg
    audit(user, request.client.host, "alert_settings", **{k: v for k, v in cfg.items() if k != "muted"}, muted=len(muted))
    return cfg
