"""Containers: Docker containers on this machine. List them, start, stop or restart one, read its log.

Docker access is the same as root, so everything goes through a root helper that allows only those four things and
only for a container id Docker itself lists. If Docker is not installed or its service is stopped the page says so.
"""
import json, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/containers")

HELPER = "/usr/local/sbin/adminpanel-docker"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
ID = r"^[0-9a-f]{64}$"


class Act(BaseModel):
    id: str = Field(pattern=ID)
    action: Literal["start", "stop", "restart"]


def run(*args, timeout=100):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Docker took too long to answer")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The Docker helper failed")[:300])
    return r


@router.get("")
def listing(user: str = Depends(current_user)):
    try:
        return json.loads(run("list", timeout=60).stdout)
    except ValueError:
        raise HTTPException(500, "The Docker helper returned something unexpected")


@router.post("/action")
def action(body: Act, request: Request, user: str = Depends(current_user)):
    try:
        run(body.action, body.id)
        ok = True
    except HTTPException:
        audit(user, request.client.host, "container_" + body.action, target=body.id[:12], ok=False)
        raise
    audit(user, request.client.host, "container_" + body.action, target=body.id[:12], ok=ok)
    return {"ok": True}


@router.get("/logs")
def logs(id: str, user: str = Depends(current_user)):
    import re
    if not re.fullmatch(ID[1:-1], id):
        raise HTTPException(400, "Invalid container id")
    return {"log": run("logs", id, timeout=40).stdout}
