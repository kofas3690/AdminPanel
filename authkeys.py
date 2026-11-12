"""SSH keys: list, add and remove the public keys that let a user sign in over SSH without a password.

Everything goes through a root helper that works on ~/.ssh/authorized_keys as that user (so a link in their home folder
cannot reach anything else), accepts only plain one-line public keys and removes a key by its SHA256 fingerprint.
"""
import json, re, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/authkeys")

HELPER = "/usr/local/sbin/adminpanel-sshkeys"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME = r"^[a-z_][a-z0-9_-]{0,31}$"


class Add(BaseModel):
    user: str = Field(pattern=NAME)
    key: str = Field(min_length=20, max_length=8192)


class Remove(BaseModel):
    user: str = Field(pattern=NAME)
    fingerprint: str = Field(pattern=r"^SHA256:[A-Za-z0-9+/]{43}$")


def run(*args, stdin=None, timeout=30):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, input=stdin, stdin=None if stdin is not None else subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The SSH keys helper took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The SSH keys helper failed")[:300])
    return r


def parse(r):
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The SSH keys helper returned something unexpected")


@router.get("/users")
def users(user: str = Depends(current_user)):
    return parse(run("users"))


@router.get("")
def keys(name: str, user: str = Depends(current_user)):
    if not re.fullmatch(NAME, name):
        raise HTTPException(422, "Invalid user name")
    return parse(run("list", name))


@router.post("/add")
def add(body: Add, request: Request, user: str = Depends(current_user)):
    try:
        res = parse(run("add", body.user, stdin=body.key))
    except HTTPException:
        audit(user, request.client.host, "sshkey_add", target=body.user, ok=False)
        raise
    audit(user, request.client.host, "sshkey_add", target=body.user, fingerprint=res.get("fingerprint", ""), ok=True)
    return res


@router.post("/remove")
def remove(body: Remove, request: Request, user: str = Depends(current_user)):
    try:
        run("remove", body.user, body.fingerprint)
    except HTTPException:
        audit(user, request.client.host, "sshkey_remove", target=body.user, fingerprint=body.fingerprint, ok=False)
        raise
    audit(user, request.client.host, "sshkey_remove", target=body.user, fingerprint=body.fingerprint, ok=True)
    return {"ok": True}
