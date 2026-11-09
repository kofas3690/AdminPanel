import json, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/users")

HELPER = "/usr/local/sbin/adminpanel-users"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME_RE = r"^[a-z_][a-z0-9_-]{0,31}$"


class Name(BaseModel):
    name: str = Field(pattern=NAME_RE)


class NewPassword(Name):
    password: str = Field(min_length=12, max_length=128)


def run(*args, stdin=None):
    kw = {"input": stdin} if stdin is not None else {"stdin": subprocess.DEVNULL}
    return subprocess.run(["/usr/bin/sudo", "-n", HELPER, *args],
                          capture_output=True, text=True, timeout=60,
                          env=ENV, **kw)


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or r.stdout).strip() or "Command failed")
    return r


def do(event, request, user, name, *args, stdin=None, **extra):
    r = run(*args, stdin=stdin)
    audit(user, request.client.host, event, target=name, ok=(r.returncode == 0), **extra)
    must(r)
    return {"ok": True}


@router.get("")
def list_users(user: str = Depends(current_user)):
    return json.loads(must(run("list")).stdout)


@router.post("/create")
def create(body: Name, request: Request, user: str = Depends(current_user)):
    return do("user_create", request, user, body.name, "create", body.name)


@router.post("/password")
def password(body: NewPassword, request: Request, user: str = Depends(current_user)):
    return do("user_setpass", request, user, body.name,
              "setpass", body.name, stdin=body.password + "\n")


@router.post("/lock")
def lock(body: Name, request: Request, user: str = Depends(current_user)):
    return do("user_lock", request, user, body.name, "lock", body.name)


@router.post("/unlock")
def unlock(body: Name, request: Request, user: str = Depends(current_user)):
    return do("user_unlock", request, user, body.name, "unlock", body.name)


@router.post("/delete")
def delete(body: Name, request: Request, user: str = Depends(current_user)):
    return do("user_delete", request, user, body.name, "delete", body.name)


class Group(BaseModel):
    group: str = Field(pattern=NAME_RE)


class Member(Name, Group):
    pass


@router.get("/groups")
def groups(user: str = Depends(current_user)):
    return json.loads(must(run("groups")).stdout)


@router.post("/groups/create")
def group_create(body: Group, request: Request, user: str = Depends(current_user)):
    return do("group_create", request, user, body.group, "mkgroup", body.group)


@router.post("/groups/delete")
def group_delete(body: Group, request: Request, user: str = Depends(current_user)):
    return do("group_delete", request, user, body.group, "rmgroup", body.group)


@router.post("/groups/add")
def group_add(body: Member, request: Request, user: str = Depends(current_user)):
    return do("group_add_member", request, user, body.name, "addgroup", body.name, body.group, group=body.group)


@router.post("/groups/remove")
def group_remove(body: Member, request: Request, user: str = Depends(current_user)):
    return do("group_remove_member", request, user, body.name, "delgroup", body.name, body.group, group=body.group)
