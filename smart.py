"""Disk health (SMART) for the Storage > Health tab and the Alerts page.

A root helper reads the health report of every physical disk. Asking a disk takes a moment, so the answer is
cached and refreshed in the background once an hour; the Health tab can also ask for a fresh reading.
"""
import json, subprocess, threading, time
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user

router = APIRouter(prefix="/api/smart")

HELPER = "/usr/local/sbin/adminpanel-smart"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
REFRESH = 3600
_lock = threading.Lock()
_cache = {"t": 0, "data": None}


def read():
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "report"], capture_output=True, text=True, timeout=300, env=ENV,
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Reading the disks took too long")
    if r.returncode != 0:
        raise HTTPException(500, ((r.stderr or r.stdout).strip() or "The disk health helper failed")[:200])
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The disk health helper returned something unexpected")


def refresh():
    with _lock:
        d = read()
        _cache["data"], _cache["t"] = d, int(time.time())
        return dict(_cache)


def cached():
    """The last reading, or None. Never talks to the disks, so it is safe to call from a busy request."""
    return _cache["data"]


@router.get("")
def report(fresh: bool = False, user: str = Depends(current_user)):
    c = _cache
    if fresh or c["data"] is None or time.time() - c["t"] > 300:
        c = refresh()
    return {"t": c["t"], **c["data"]}


def loop():
    time.sleep(45)
    while True:
        try:
            refresh()
        except Exception:
            pass
        time.sleep(REFRESH)


def start():
    threading.Thread(target=loop, daemon=True, name="smart").start()
