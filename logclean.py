"""Log cleanup: how much disk the logs use, and trimming the system journal.

A root helper reports sizes (names, sizes and times only, never contents) and runs journalctl's own vacuum with a number
chosen within fixed limits. Plain log files are never deleted from here.
"""
import json, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/logclean")

HELPER = "/usr/local/sbin/adminpanel-logclean"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}


class Vacuum(BaseModel):
    mode: Literal["size", "time"]
    value: int = Field(ge=1, le=102400)


def run(*args, timeout=330):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The log helper took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The log helper failed")[:300])
    return r


@router.get("")
def status(user: str = Depends(current_user)):
    try:
        return json.loads(run("status", timeout=120).stdout)
    except ValueError:
        raise HTTPException(500, "The log helper returned something unexpected")


@router.post("/vacuum")
def vacuum(body: Vacuum, request: Request, user: str = Depends(current_user)):
    try:
        res = json.loads(run("vacuum-" + body.mode, str(body.value)).stdout)
    except HTTPException:
        audit(user, request.client.host, "journal_vacuum", mode=body.mode, value=body.value, ok=False)
        raise
    except ValueError:
        raise HTTPException(500, "The log helper returned something unexpected")
    audit(user, request.client.host, "journal_vacuum", mode=body.mode, value=body.value, ok=True)
    return res
