"""Disk usage: what is taking the space inside a folder.

Read only. A root helper measures each item directly inside the chosen folder (metadata only: it never opens a file,
never follows symlinks and stays on one filesystem), because ordinary accounts cannot read most system folders.
Click a folder on the page to look inside it.
"""
import json, os, re, subprocess
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user

router = APIRouter(prefix="/api/du")

HELPER = "/usr/local/sbin/adminpanel-du"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
BAD = re.compile(r"[\x00-\x1f\x7f]")


def valid_path(p):
    return p.startswith("/") and len(p) <= 1024 and not BAD.search(p)


@router.get("")
def scan(path: str = "/", user: str = Depends(current_user)):
    if not valid_path(path):
        raise HTTPException(400, "The folder must be an absolute path")
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "scan", path], capture_output=True, text=True, timeout=45, env=ENV,
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Measuring that folder took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The helper failed")[:200])
    try:
        d = json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The helper returned something unexpected")
    try:
        v = os.statvfs(d["path"])
        d["fs"] = {"total": v.f_blocks * v.f_frsize, "free": v.f_bavail * v.f_frsize}
    except OSError:
        d["fs"] = None
    return d
