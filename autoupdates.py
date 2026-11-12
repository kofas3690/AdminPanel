"""Automatic updates: whether the machine installs security updates by itself, and switching that on or off.

Everything goes through a root helper that writes one fixed configuration file; the only input it accepts is on or off.
If the unattended-upgrades package is not installed the page says so and points to the Packages page.
"""
import json, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/autoupdates")

HELPER = "/usr/local/sbin/adminpanel-autoupd"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


class Setting(BaseModel):
    enabled: bool


def run(*args, timeout=30):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The helper took too long to answer")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The automatic updates helper failed")[:300])
    return r


@router.get("")
def status(user: str = Depends(current_user)):
    try:
        return json.loads(run("status").stdout)
    except ValueError:
        raise HTTPException(500, "The automatic updates helper returned something unexpected")


@router.post("")
def change(body: Setting, request: Request, user: str = Depends(current_user)):
    word = "on" if body.enabled else "off"
    try:
        run("set", word)
    except HTTPException:
        audit(user, request.client.host, "autoupdates_" + word, ok=False)
        raise
    audit(user, request.client.host, "autoupdates_" + word, ok=True)
    return {"ok": True}
