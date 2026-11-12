"""Blocked addresses: what fail2ban is blocking on this machine, and lifting a block.

Everything goes through a root helper that can only list jails and lift one block, for a jail fail2ban itself lists.
If fail2ban is not installed or its service is stopped the page says so.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/blocked")

HELPER = "/usr/local/sbin/adminpanel-f2b"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


class Unban(BaseModel):
    jail: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$")
    ip: str = Field(min_length=2, max_length=45, pattern=r"^[0-9A-Fa-f:.]+$")


def run(*args, timeout=60):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "fail2ban took too long to answer")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The fail2ban helper failed")[:300])
    return r


@router.get("")
def listing(user: str = Depends(current_user)):
    try:
        return json.loads(run("list", timeout=90).stdout)
    except ValueError:
        raise HTTPException(500, "The fail2ban helper returned something unexpected")


@router.post("/unban")
def unban(body: Unban, request: Request, user: str = Depends(current_user)):
    try:
        run("unban", body.jail, body.ip)
    except HTTPException:
        audit(user, request.client.host, "unban_address", target=body.ip, jail=body.jail, ok=False)
        raise
    audit(user, request.client.host, "unban_address", target=body.ip, jail=body.jail, ok=True)
    return {"ok": True}
