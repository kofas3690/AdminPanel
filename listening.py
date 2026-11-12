"""Listening ports: which programs are waiting for connections on this machine, and who can reach them.

Read only. A root helper runs `ss` (root is needed to see which program owns a socket) and returns cleaned rows.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user

router = APIRouter(prefix="/api/listening")

HELPER = "/usr/local/sbin/adminpanel-ports"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


@router.get("")
def listing(user: str = Depends(current_user)):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "list"], capture_output=True, text=True, errors="replace", timeout=40,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Listing the ports took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The ports helper failed")[:300])
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The ports helper returned something unexpected")
