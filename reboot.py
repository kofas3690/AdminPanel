"""Restart status: does this machine need a reboot, since when, and why.

Ubuntu drops /run/reboot-required (and the package names in /run/reboot-required.pkgs) when an upgrade needs a
restart. This also compares the running kernel with the newest one installed in /boot, which is the usual reason.
Everything is read as the panel's own account; nothing is changed.
"""
import os, re, time
from pathlib import Path
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api/reboot")

FLAG = Path("/run/reboot-required")
PKGS = Path("/run/reboot-required.pkgs")
BOOT = Path("/boot")
PKG_RE = re.compile(r"[a-z0-9][a-z0-9.+:-]{0,100}")
KERNEL_RE = re.compile(r"vmlinuz-(\d[\w.+~-]*)")
OVERDUE_DAYS = 7


def release():
    return os.uname().release


def vkey(v):
    return tuple(int(x) for x in re.findall(r"\d+", v))


def newest_kernel(running):
    """Newest installed kernel of the same flavour (the part after the version, such as -generic or -aws)."""
    flavour = re.sub(r"^[\d.]+(-\d+)?", "", running)
    best = None
    try:
        names = [p.name for p in BOOT.iterdir()]
    except OSError:
        return None
    for n in names:
        m = KERNEL_RE.fullmatch(n)
        if not m:
            continue
        v = m.group(1)
        if re.sub(r"^[\d.]+(-\d+)?", "", v) != flavour:
            continue
        if best is None or vkey(v) > vkey(best):
            best = v
    return best


def uptime_days():
    try:
        return int(float(Path("/proc/uptime").read_text().split()[0]) // 86400)
    except (OSError, ValueError, IndexError):
        return None


def info(now=None):
    now = now or time.time()
    required = FLAG.exists()
    since = None
    if required:
        try:
            since = int(FLAG.stat().st_mtime)
        except OSError:
            pass
    pkgs = []
    try:
        if not required:
            raise OSError
        pkgs = sorted({l.strip() for l in PKGS.read_text().splitlines() if PKG_RE.fullmatch(l.strip())})[:50]
    except OSError:
        pass
    running = release()
    newest = newest_kernel(running)
    behind = bool(newest and vkey(newest) > vkey(running))
    return {"required": required, "since": since, "days": int((now - since) // 86400) if since else None,
            "packages": pkgs, "running_kernel": running, "newest_kernel": newest, "kernel_behind": behind,
            "uptime_days": uptime_days()}


@router.get("")
def status(user: str = Depends(current_user)):
    return info()
