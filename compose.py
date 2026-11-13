"""Compose: Docker Compose projects on this machine. List them with their services, start, stop, restart, pull new
images, apply (up -d), read the log and view the compose file.

Docker access is the same as root, so everything goes through a root helper with a fixed set of verbs that works only
on projects Docker itself lists, using the compose files Docker recorded for them. It cannot create a project, run
`down`, remove volumes or images, or run a command inside a container.
"""
import json, re, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/compose")

HELPER = "/usr/local/sbin/adminpanel-compose"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME = r"^[a-z0-9][a-z0-9_-]{0,63}$"
TIMEOUT = {"start": 200, "stop": 200, "restart": 260, "pull": 920, "up": 620}


class Act(BaseModel):
    name: str = Field(pattern=NAME)
    action: Literal["start", "stop", "restart", "pull", "up"]


def run(*args, timeout=100):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Docker took too long to answer")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The Compose helper failed")[:300])
    return r


def checked(name):
    if not re.fullmatch(NAME, name or ""):
        raise HTTPException(400, "Invalid project name")
    return name


@router.get("")
def listing(user: str = Depends(current_user)):
    try:
        return json.loads(run("list", timeout=240).stdout)
    except ValueError:
        raise HTTPException(500, "The Compose helper returned something unexpected")


@router.post("/action")
def action(body: Act, request: Request, user: str = Depends(current_user)):
    try:
        out = run(body.action, body.name, timeout=TIMEOUT[body.action]).stdout
    except HTTPException:
        audit(user, request.client.host, "compose_" + body.action, target=body.name, ok=False)
        raise
    audit(user, request.client.host, "compose_" + body.action, target=body.name, ok=True)
    return {"ok": True, "output": out[-20000:]}


@router.get("/logs")
def logs(name: str, user: str = Depends(current_user)):
    return {"log": run("logs", checked(name), timeout=60).stdout}


@router.get("/file")
def file(name: str, user: str = Depends(current_user)):
    try:
        return json.loads(run("file", checked(name), timeout=40).stdout)
    except ValueError:
        raise HTTPException(500, "The Compose helper returned something unexpected")
