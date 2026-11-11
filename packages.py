"""Packages: search, install and remove software through the same safe job runner as the updates page.

Looking is unprivileged. `plan` runs apt's own dry run (`apt-get -s`) as the panel's account and reports what a
change would add or take away, so the person sees the consequences before confirming. The change itself is done
by `adminpanel-apt install|remove NAME`, which re-checks the name and refuses removals that would take out
something the machine needs. The job, its log and its progress are the ones the Software updates page already uses.
"""
import re, subprocess, threading
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Literal
from auth import current_user
from audit import audit
import updates

router = APIRouter(prefix="/api/packages")

APT_CACHE = "/usr/bin/apt-cache"
APT_GET = "/usr/bin/apt-get"
DPKG_QUERY = "/usr/bin/dpkg-query"
NAME_RE = re.compile(r"[a-z0-9][a-z0-9+.-]{1,99}")
TERM_RE = re.compile(r"[A-Za-z0-9 .+_-]{2,40}")
MAX_RESULTS = 60
PLAN_LINE = re.compile(r"^(Inst|Remv) (\S+) (?:\[([^\]]+)\] )?\(?([^ )]*)")


def run(args, timeout=60):
    try:
        return subprocess.run(args, capture_output=True, encoding="utf-8", errors="replace", timeout=timeout,
                              env=updates.ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The package system took too long to answer")


def installed_map():
    r = run([DPKG_QUERY, "-W", "-f", "${binary:Package}\t${Version}\t${db:Status-Status}\t${Essential}\t${Priority}\t${binary:Summary}\n"])
    out = {}
    for line in r.stdout.splitlines():
        p = line.split("\t")
        if len(p) >= 6 and p[2] == "installed":
            out[p[0].split(":")[0]] = {"name": p[0].split(":")[0], "version": p[1], "essential": p[3] == "yes",
                                       "priority": p[4], "summary": p[5][:160]}
    return out


@router.get("/installed")
def installed(user: str = Depends(current_user)):
    pk = sorted(installed_map().values(), key=lambda x: x["name"])
    for x in pk:
        x["locked"] = x["essential"] or x["priority"] == "required"
    return {"count": len(pk), "packages": pk}


@router.get("/search")
def search(q: str, user: str = Depends(current_user)):
    q = q.strip()
    if not TERM_RE.fullmatch(q):
        raise HTTPException(400, "Search for 2 to 40 letters, digits, spaces or . + _ -")
    r = run([APT_CACHE, "search", "--"] + q.split())
    have = installed_map()
    out = []
    for line in r.stdout.splitlines():
        name, sep, desc = line.partition(" - ")
        name = name.strip()
        if not sep or not NAME_RE.fullmatch(name):
            continue
        out.append({"name": name, "summary": desc[:160], "installed": name in have,
                    "version": have[name]["version"] if name in have else ""})
        if len(out) >= MAX_RESULTS:
            break
    out.sort(key=lambda x: (q.lower() not in x["name"].lower(), x["name"]))
    return {"results": out, "capped": len(out) >= MAX_RESULTS}


@router.get("/plan")
def plan(action: Literal["install", "remove"], name: str, user: str = Depends(current_user)):
    if not NAME_RE.fullmatch(name):
        raise HTTPException(400, "That is not a valid package name")
    r = run([APT_GET, "-s", "-y", "-o", "Debug::NoLocking=1", action, "--", name], timeout=90)
    if r.returncode != 0:
        msg = [l for l in (r.stdout + r.stderr).splitlines() if l.startswith("E:")]
        raise HTTPException(400, (msg[0][3:] if msg else "apt cannot do that").strip()[:300])
    add, remove, size = [], [], ""
    for line in r.stdout.splitlines():
        m = PLAN_LINE.match(line)
        if m:
            (add if m.group(1) == "Inst" else remove).append(m.group(2))
        elif line.startswith("After this operation,"):
            size = line.strip()[:120]
    return {"action": action, "name": name, "add": add[:100], "remove": remove[:100], "size": size}


class Change(BaseModel):
    action: Literal["install", "remove"]
    name: str


@router.post("/run")
def run_change(body: Change, request: Request, user: str = Depends(current_user)):
    if not NAME_RE.fullmatch(body.name):
        raise HTTPException(400, "That is not a valid package name")
    with updates.start_lock:
        r = run([updates.SUDO, "-n", updates.HELPER, body.action, body.name], timeout=60)
        if r.returncode == 3:
            raise HTTPException(409, "A job is already running")
        if r.returncode in (2, 4):
            raise HTTPException(400, (r.stderr or r.stdout).strip()[:300] or "Not allowed")
        if r.returncode != 0:
            raise HTTPException(500, (r.stderr or r.stdout).strip()[:300] or "Could not start the job")
        jid = updates.read("apt-job.id")
        updates.started.clear()
        updates.started.update(id=jid, kind=body.action + " " + body.name, user=user, ip=request.client.host, audited=False)
    audit(user, request.client.host, "apt_started", kind=body.action, package=body.name)
    return {"id": jid}
