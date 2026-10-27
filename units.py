import json, re, subprocess
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/units")

SYSTEMCTL = "/usr/bin/systemctl"
JOURNALCTL = "/usr/bin/journalctl"
SUDO = "/usr/bin/sudo"
HELPER = "/usr/local/sbin/adminpanel-units"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
TYPES = "service,socket,timer,path,target"
UNIT_RE = re.compile(
    r"[A-Za-z0-9_](?:[A-Za-z0-9:_.@-]|\\x[0-9a-f]{2}){0,200}\.(service|socket|timer|path|target)")

PROPS = ("Id,Description,LoadState,ActiveState,SubState,UnitFileState,FragmentPath,DropInPaths,"
         "MainPID,ExecMainStatus,Result,ActiveEnterTimestamp,InactiveEnterTimestamp,"
         "MemoryCurrent,TasksCurrent,CPUUsageNSec,NRestarts,Type,Documentation,"
         "CanStart,CanStop,CanReload,Requires,Wants,BindsTo,PartOf,After,Before,"
         "Conflicts,WantedBy,RequiredBy,TriggeredBy,Triggers")
LISTS = {"Requires", "Wants", "BindsTo", "PartOf", "After", "Before", "Conflicts",
         "WantedBy", "RequiredBy", "TriggeredBy", "Triggers", "DropInPaths", "Documentation"}
UNSET = {"", "[not set]", "18446744073709551615", "n/a"}


def check(name):
    if not UNIT_RE.fullmatch(name):
        raise HTTPException(400, "Invalid unit name")
    return name


def run(cmd, timeout=20):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                              env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The system took too long to answer")


def sc(*args):
    return run([SYSTEMCTL, *args])


def js(r):
    try:
        return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else []
    except ValueError:
        return []


def us(v):
    return v / 1e6 if isinstance(v, (int, float)) and v > 0 else None


@router.get("")
def list_units(user: str = Depends(current_user)):
    units = {}
    for u in js(sc("list-units", "--all", "--no-pager", "--plain",
                   "--output=json", f"--type={TYPES}")):
        name = u.get("unit") or ""
        if not name or u.get("load") == "not-found" or "@." in name:
            continue
        units[name] = {"name": name, "description": u.get("description") or "",
                       "active": u.get("active") or "", "sub": u.get("sub") or "",
                       "file_state": ""}
    for f in js(sc("list-unit-files", "--no-pager", "--output=json", f"--type={TYPES}")):
        name = (f.get("unit_file") or "").rsplit("/", 1)[-1]
        if not name or "@." in name:
            continue
        u = units.setdefault(name, {"name": name, "description": "", "active": "inactive",
                                    "sub": "dead", "file_state": ""})
        u["file_state"] = f.get("state") or ""
    if not units:
        raise HTTPException(502, "systemctl did not return a unit list")
    out = sorted(units.values(), key=lambda u: u["name"])
    for u in out:
        u["type"] = u["name"].rsplit(".", 1)[-1]
    return out


@router.get("/extras")
def extras(user: str = Depends(current_user)):
    timers, sockets = {}, {}
    for t in js(sc("list-timers", "--all", "--no-pager", "--output=json")):
        timers[t.get("unit") or ""] = {"next": us(t.get("next")), "last": us(t.get("last")),
                                       "activates": t.get("activates") or ""}
    for s in js(sc("list-sockets", "--all", "--no-pager", "--output=json")):
        e = sockets.setdefault(s.get("unit") or "", {"listen": [], "activates": s.get("activates") or ""})
        if s.get("listen"):
            e["listen"].append(s["listen"])
    return {"timers": timers, "sockets": sockets}


@router.get("/detail")
def detail(name: str, user: str = Depends(current_user)):
    check(name)
    props = {}
    for line in sc("show", f"--property={PROPS}", name).stdout.splitlines():
        k, sep, v = line.partition("=")
        if sep:
            props[k] = v
    if not props or props.get("LoadState") == "not-found":
        raise HTTPException(404, "No such unit")
    out = {}
    for k, v in props.items():
        if k in LISTS:
            out[k] = v.split()[:100]
        elif v in UNSET:
            out[k] = None
        else:
            out[k] = v
    st = sc("status", "--no-pager", "--full", "-n", "0", name)
    pol = {"actions": [], "reason": "Could not check permissions"}
    p = run([SUDO, "-n", HELPER, "policy", name])
    if p.returncode == 0:
        try:
            pol = json.loads(p.stdout)
        except ValueError:
            pass
    return {"name": name, "props": out, "status": (st.stdout or st.stderr)[:8000],
            "actions": pol["actions"], "reason": pol["reason"]}


@router.get("/logs")
def logs(name: str, lines: int = 200, user: str = Depends(current_user)):
    check(name)
    n = max(10, min(lines, 1000))
    r = run([JOURNALCTL, "-u", name, "-n", str(n), "--no-pager", "-o", "short-iso"])
    text = r.stdout if r.returncode == 0 else (r.stderr or "No logs available")
    return {"text": text[-200000:]}


class ActionBody(BaseModel):
    name: str
    action: Literal["start", "stop", "restart", "reload", "enable", "disable", "reset-failed"]


@router.post("/action")
def action(body: ActionBody, request: Request, user: str = Depends(current_user)):
    check(body.name)
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "act", body.action, body.name],
                           capture_output=True, text=True, timeout=100, env=ENV,
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        audit(user, request.client.host, "unit_action", unit=body.name,
              action=body.action, ok=False)
        raise HTTPException(504, "The action took too long. Check the unit's state.")
    audit(user, request.client.host, "unit_action", unit=body.name,
          action=body.action, ok=(r.returncode == 0))
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or r.stdout).strip() or "Command failed")
    return {"ok": True, "message": r.stdout.strip()}
