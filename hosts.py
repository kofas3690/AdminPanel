"""Hosts file: the list of names this machine resolves itself, before it asks DNS (/etc/hosts).

The panel shows the whole file but only adds and removes entries inside its own marked block, through a root helper that
checks every address and name. Useful for pointing a name at a test server, or blocking a name with 0.0.0.0.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/hosts")

HELPER = "/usr/local/sbin/adminpanel-hosts"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
ADDR = r"^[0-9A-Fa-f:.]{2,45}$"
NAME = r"^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$"


class Entry(BaseModel):
    address: str = Field(pattern=ADDR)
    name: str = Field(pattern=NAME)


def run(*args, timeout=30):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The hosts helper took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The hosts helper failed")[:300])
    return r


@router.get("")
def listing(user: str = Depends(current_user)):
    try:
        return json.loads(run("list").stdout)
    except ValueError:
        raise HTTPException(500, "The hosts helper returned something unexpected")


def change(verb, event, body: Entry, request: Request, user: str):
    try:
        run(verb, body.address, body.name)
    except HTTPException:
        audit(user, request.client.host, event, ok=False, address=body.address, name=body.name)
        raise
    audit(user, request.client.host, event, ok=True, address=body.address, name=body.name)
    return {"ok": True}


@router.post("/add")
def add(body: Entry, request: Request, user: str = Depends(current_user)):
    return change("add", "hosts_add", body, request, user)


@router.post("/remove")
def remove(body: Entry, request: Request, user: str = Depends(current_user)):
    return change("remove", "hosts_remove", body, request, user)
