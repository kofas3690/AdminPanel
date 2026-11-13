"""Websites: the sites nginx serves, a configuration test, and a safe reload.

A root helper reads the site files under /etc/nginx (names, ports, folders, certificates, proxy targets) and reloads nginx
only after nginx's own test passes. Nothing here edits a configuration file.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/websites")

HELPER = "/usr/local/sbin/adminpanel-nginx"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


def run(*args, timeout=60):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The web server helper took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The web server helper failed")[:600])
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The web server helper returned something unexpected")


@router.get("")
def listing(user: str = Depends(current_user)):
    return run("list")


@router.post("/test")
def test(user: str = Depends(current_user)):
    return run("test")


@router.post("/reload")
def reload(request: Request, user: str = Depends(current_user)):
    try:
        res = run("reload")
    except HTTPException:
        audit(user, request.client.host, "nginx_reload", ok=False)
        raise
    audit(user, request.client.host, "nginx_reload", ok=True)
    return res
