"""Certificates: when the TLS certificates this machine serves expire.

A read-only root helper finds the certificates (the panel's own, Let's Encrypt, and the ones nginx uses) and
reports their names and dates; it never reads a private key. The answer is cached and refreshed hourly, so the
Alerts page can warn before a certificate runs out without touching any file on each request.
"""
import json, math, subprocess, threading, time
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user

router = APIRouter(prefix="/api/certs")

HELPER = "/usr/local/sbin/adminpanel-certs"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
REFRESH = 3600
WARN_DAYS = 21
CRIT_DAYS = 7
_lock = threading.Lock()
_cache = {"t": 0, "data": None}


def read():
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "report"], capture_output=True, text=True, timeout=60, env=ENV,
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Reading the certificates took too long")
    if r.returncode != 0:
        raise HTTPException(500, ((r.stderr or r.stdout).strip() or "The certificate helper failed")[:200])
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The certificate helper returned something unexpected")


def refresh():
    with _lock:
        d = read()
        _cache["data"], _cache["t"] = d, int(time.time())
        return dict(_cache)


def cached():
    return _cache["data"]


def status_of(c, now):
    left = (c["end"] - now) / 86400
    if left < 0:
        return "expired", left
    if left <= CRIT_DAYS:
        return "critical", left
    if left <= WARN_DAYS:
        return "warning", left
    return "ok", left


def annotate(data, now):
    out = []
    for c in data.get("certs", []):
        st, left = status_of(c, now)
        out.append({**c, "status": st, "days_left": math.floor(left)})
    out.sort(key=lambda c: c["end"])
    return out


@router.get("")
def report(fresh: bool = False, user: str = Depends(current_user)):
    c = _cache
    if fresh or c["data"] is None or time.time() - c["t"] > 300:
        c = refresh()
    now = int(time.time())
    return {"t": c["t"], "now": now, "certs": annotate(c["data"], now)}


def loop():
    time.sleep(60)
    while True:
        try:
            refresh()
        except Exception:
            pass
        time.sleep(REFRESH)


def start():
    threading.Thread(target=loop, daemon=True, name="certs").start()
