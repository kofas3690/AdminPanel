"""Web logs: the end of nginx's log files with a plain-text filter, and a summary of an access log.

A root helper reads the files (the web server's logs are not readable by the panel's own account) and only accepts a file
from its own listing. The filter is sent on standard input and matched as plain text.
"""
import json, subprocess
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth import current_user

router = APIRouter(prefix="/api/weblogs")

HELPER = "/usr/local/sbin/adminpanel-weblogs"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$"


class Tail(BaseModel):
    name: str = Field(pattern=NAME)
    lines: int = Field(ge=10, le=1000)
    filter: str = Field(default="", max_length=200)


def run(*args, stdin=None, timeout=60):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, input=stdin if stdin is not None else "", )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The web logs helper took too long")
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The web logs helper failed")[:300])
    try:
        return json.loads(r.stdout)
    except ValueError:
        raise HTTPException(500, "The web logs helper returned something unexpected")


@router.get("")
def listing(user: str = Depends(current_user)):
    return run("list")


@router.post("/tail")
def tail(body: Tail, user: str = Depends(current_user)):
    return run("tail", body.name, str(body.lines), stdin=body.filter)


@router.get("/summary")
def summary(name: str, user: str = Depends(current_user)):
    import re
    if not re.fullmatch(NAME, name):
        raise HTTPException(422, "Invalid file name")
    return run("summary", name)
