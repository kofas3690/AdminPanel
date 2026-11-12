"""Swap: memory on disk that the machine uses when RAM runs out. Show it, create or remove the swap file, set swappiness.

Everything goes through a root helper that only ever touches the file /swapfile and accepts only a size in megabytes or
a swappiness number. Small cloud machines often have no swap at all, which is why this page exists.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/swap")

HELPER = "/usr/local/sbin/adminpanel-swap"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


class Create(BaseModel):
    size_mb: int = Field(ge=128, le=65536)


class Swappiness(BaseModel):
    value: int = Field(ge=0, le=100)


def run(*args, timeout=700):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The swap helper took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The swap helper failed")[:300])
    return r


def changed(user, request, event, ok, **detail):
    audit(user, request.client.host, event, ok=ok, **detail)


@router.get("")
def status(user: str = Depends(current_user)):
    try:
        return json.loads(run("status", timeout=30).stdout)
    except ValueError:
        raise HTTPException(500, "The swap helper returned something unexpected")


@router.post("/create")
def create(body: Create, request: Request, user: str = Depends(current_user)):
    try:
        run("create", str(body.size_mb))
    except HTTPException:
        changed(user, request, "swap_create", False, size_mb=body.size_mb)
        raise
    changed(user, request, "swap_create", True, size_mb=body.size_mb)
    return {"ok": True}


@router.post("/remove")
def remove(request: Request, user: str = Depends(current_user)):
    try:
        run("remove")
    except HTTPException:
        changed(user, request, "swap_remove", False)
        raise
    changed(user, request, "swap_remove", True)
    return {"ok": True}


@router.post("/swappiness")
def swappiness(body: Swappiness, request: Request, user: str = Depends(current_user)):
    try:
        run("swappiness", str(body.value), timeout=40)
    except HTTPException:
        changed(user, request, "swap_swappiness", False, value=body.value)
        raise
    changed(user, request, "swap_swappiness", True, value=body.value)
    return {"ok": True}
