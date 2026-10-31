import json, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/uunits")

SUDO = "/usr/bin/sudo"
HELPER = "/usr/local/sbin/adminpanel-userunits"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
USER_PATTERN = r"^[a-z_][a-z0-9_-]{0,31}$"
UNIT_PATTERN = r"^[A-Za-z0-9_](?:[A-Za-z0-9:_.@-]|\\x[0-9a-f]{2}){0,200}\.(?:service|socket|timer|path|target)$"


def call(cmd, payload=None, timeout=60):
    kw = {"input": json.dumps(payload)} if payload is not None else {"stdin": subprocess.DEVNULL}
    try:
        return subprocess.run([SUDO, "-n", HELPER, cmd], capture_output=True, text=True,
                              timeout=timeout, env=ENV, **kw)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The helper took too long to answer")


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or r.stdout).strip()[:2000] or "Command failed")
    return r


@router.get("/users")
def users(user: str = Depends(current_user)):
    return json.loads(must(call("users")).stdout)


@router.get("/list")
def list_units(account: str = Query(..., pattern=USER_PATTERN), extras: bool = False,
               user: str = Depends(current_user)):
    return json.loads(must(call("list", {"user": account, "extras": extras})).stdout)


@router.get("/detail")
def detail(account: str = Query(..., pattern=USER_PATTERN), name: str = Query(..., pattern=UNIT_PATTERN),
           user: str = Depends(current_user)):
    return json.loads(must(call("detail", {"user": account, "name": name})).stdout)


@router.get("/logs")
def logs(account: str = Query(..., pattern=USER_PATTERN), name: str = Query(..., pattern=UNIT_PATTERN),
         lines: int = 200, user: str = Depends(current_user)):
    return json.loads(must(call("logs", {"user": account, "name": name, "lines": lines})).stdout)


class ActionBody(BaseModel):
    account: str = Field(pattern=USER_PATTERN)
    name: str = Field(pattern=UNIT_PATTERN)
    action: Literal["start", "stop", "restart", "reload", "enable", "disable", "reset-failed"]


@router.post("/action")
def action(body: ActionBody, request: Request, user: str = Depends(current_user)):
    r = call("act", {"user": body.account, "name": body.name, "action": body.action}, timeout=100)
    audit(user, request.client.host, "user_unit_action", account=body.account, unit=body.name,
          action=body.action, ok=(r.returncode == 0))
    must(r)
    return {"ok": True, "message": r.stdout.strip()}


class ManagerBody(BaseModel):
    account: str = Field(pattern=USER_PATTERN)
    op: Literal["start", "linger-on", "linger-off"]


@router.post("/manager")
def manager(body: ManagerBody, request: Request, user: str = Depends(current_user)):
    r = call("manager", {"user": body.account, "op": body.op})
    audit(user, request.client.host, "user_manager", account=body.account, op=body.op,
          ok=(r.returncode == 0))
    must(r)
    return {"ok": True}
