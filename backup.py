"""Backups: choose folders, a schedule and how many copies to keep; back up now; check or delete copies.

The work is done by a root helper. Copies live in a folder only root can read, so this page can list,
check and delete them but can never read what is inside them. Restoring needs root and is done on the console.
"""
import json, subprocess
from typing import List, Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/backup")

HELPER = "/usr/local/sbin/adminpanel-backup"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME = r"^adminpanel-backup-\d{8}-\d{6}\.tar\.gz$"


class Settings(BaseModel):
    schedule: Literal["off", "daily", "weekly"]
    hour: int = Field(ge=0, le=23)
    keep: int = Field(ge=1, le=60)
    sources: List[str] = Field(min_length=1, max_length=20)
    dest: str = Field("local", pattern=r"^(local|[a-z][a-z0-9-]{1,30})$")


class Copy(BaseModel):
    name: str = Field(pattern=NAME)


def run(*args, stdin=None, timeout=60):
    kw = {"input": stdin} if stdin is not None else {"stdin": subprocess.DEVNULL}
    try:
        return subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, timeout=timeout, env=ENV, **kw)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The backup helper took too long to answer")


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The backup helper failed")[:300])
    return r


@router.get("")
def status(user: str = Depends(current_user)):
    try:
        return json.loads(must(run("status")).stdout)
    except ValueError:
        raise HTTPException(500, "The backup helper returned something unexpected")


@router.put("/settings")
def save(body: Settings, request: Request, user: str = Depends(current_user)):
    sources = [s.strip() for s in body.sources if s.strip()]
    r = run("set", stdin=json.dumps({"schedule": body.schedule, "hour": body.hour, "keep": body.keep, "sources": sources, "dest": body.dest}))
    audit(user, request.client.host, "backup_settings", ok=(r.returncode == 0), schedule=body.schedule, keep=body.keep,
          folders=len(sources), dest=body.dest)
    must(r)
    return {"ok": True}


@router.post("/start")
def start(request: Request, user: str = Depends(current_user)):
    r = run("start")
    audit(user, request.client.host, "backup_start", ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


@router.post("/verify")
def verify(body: Copy, user: str = Depends(current_user)):
    return json.loads(must(run("verify", body.name, timeout=3700)).stdout)


@router.post("/delete")
def delete(body: Copy, request: Request, user: str = Depends(current_user)):
    r = run("delete", body.name)
    audit(user, request.client.host, "backup_delete", target=body.name, ok=(r.returncode == 0))
    must(r)
    return {"ok": True}
