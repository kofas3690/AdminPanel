"""Network shares: SMB (Windows file) and NFS shares mounted on this machine, for backups or for the File manager.

The panel never sees a mount command or touches a credentials file. A root helper keeps the list of shares and each
share's password in root-only files, checks every value again and does the mounting. Passwords are sent to it on
standard input, never on a command line, and are never shown again.
"""
import json, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/shares")

HELPER = "/usr/local/sbin/adminpanel-share"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME = r"^[a-z][a-z0-9-]{1,30}$"


class New(BaseModel):
    name: str = Field(pattern=NAME)
    protocol: Literal["smb", "nfs"] = "smb"
    server: str = Field(min_length=1, max_length=253)
    share: str = Field(min_length=1, max_length=250)
    user: str = Field("", max_length=64)
    password: str = Field("", max_length=128)
    domain: str = Field("", max_length=64)
    vers: Literal["3.1.1", "3.0", "2.1", "4.2", "4.1", "4.0", "3"] = "3.1.1"
    access: Literal["backup", "browse"] = "backup"


class Ref(BaseModel):
    name: str = Field(pattern=NAME)


def run(*args, stdin=None, timeout=70):
    kw = {"input": stdin} if stdin is not None else {"stdin": subprocess.DEVNULL}
    try:
        return subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, timeout=timeout, env=ENV, **kw)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The share helper took too long to answer")


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The share helper failed")[:300])
    return r


@router.get("")
def listing(user: str = Depends(current_user)):
    try:
        return json.loads(must(run("list")).stdout)
    except ValueError:
        raise HTTPException(500, "The share helper returned something unexpected")


@router.post("")
def add(body: New, request: Request, user: str = Depends(current_user)):
    r = run("add", stdin=json.dumps(body.model_dump()))
    audit(user, request.client.host, "share_add", target=body.name, protocol=body.protocol, server=body.server, share=body.share,
          access=body.access, ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


def action(verb, body, request, user):
    r = run(verb, body.name)
    audit(user, request.client.host, "share_" + verb, target=body.name, ok=(r.returncode == 0))
    must(r)
    try:
        return json.loads(r.stdout)
    except ValueError:
        return {"ok": True}


@router.post("/mount")
def mount(body: Ref, request: Request, user: str = Depends(current_user)):
    return action("mount", body, request, user)


@router.post("/unmount")
def unmount(body: Ref, request: Request, user: str = Depends(current_user)):
    return action("unmount", body, request, user)


@router.post("/test")
def test(body: Ref, request: Request, user: str = Depends(current_user)):
    return action("test", body, request, user)


@router.post("/remove")
def remove(body: Ref, request: Request, user: str = Depends(current_user)):
    return action("remove", body, request, user)
