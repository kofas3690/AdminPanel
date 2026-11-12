"""Security check: a short list of read-only hardening checks, each reported as ok, warn or fail.

A root helper runs the fixed checks (it needs root to read the SSH settings and the password file) and returns plain
yes/no results with a sentence; no password hash or file content ever leaves it. Nothing here changes the machine.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user

router = APIRouter(prefix="/api/seccheck")

HELPER = "/usr/local/sbin/adminpanel-audit"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
LINKS = {"/", "/firewall.html", "/blocked.html", "/autoupdates.html", "/users.html", "/clock.html", ""}


@router.get("")
def run(user: str = Depends(current_user)):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "run"], capture_output=True, text=True, errors="replace", timeout=90,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The security check took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The security check helper failed")[:300])
    try:
        items = json.loads(r.stdout)["items"]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(500, "The security check helper returned something unexpected")
    for i in items:
        if i.get("status") not in ("ok", "warn", "fail"):
            i["status"] = "warn"
        if i.get("where") not in LINKS:
            i["where"] = ""
    return {"items": items}
