"""Certificate renewal: the Let's Encrypt certificates certbot manages, a dry-run test of renewal, and renewing now.

A root helper runs fixed certbot command lines and takes no domain, path or option from anyone. `renew` only renews
certificates that are close to expiry, which is certbot's own rule, so pressing it early is harmless.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/certrenew")

HELPER = "/usr/local/sbin/adminpanel-certbot"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


def run(*args, timeout=480):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "certbot took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The certbot helper failed")[:400])
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The certbot helper returned something unexpected")


@router.get("")
def status(user: str = Depends(current_user)):
    return run("status", timeout=90)


@router.post("/test")
def test(request: Request, user: str = Depends(current_user)):
    res = run("test")
    audit(user, request.client.host, "cert_renew_test", ok=bool(res.get("ok")))
    return res


@router.post("/renew")
def renew(request: Request, user: str = Depends(current_user)):
    try:
        res = run("renew")
    except HTTPException:
        audit(user, request.client.host, "cert_renew", ok=False)
        raise
    audit(user, request.client.host, "cert_renew", ok=bool(res.get("ok")))
    return res
