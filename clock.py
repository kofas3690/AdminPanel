"""Date & time: show the clock, time zone, network time (NTP) and hostname, and change the last three.

Reading uses timedatectl as the panel's own account, which needs no privileges. Changing goes through a root
helper that re-checks every value. The time itself is never set by hand: with network time on, the machine
keeps it right, and a hand-set time is a common cause of certificate and login trouble.
"""
import re, socket, subprocess, time
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Literal
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/clock")

HELPER = "/usr/local/sbin/adminpanel-time"
SUDO = "/usr/bin/sudo"
TIMEDATECTL = "/usr/bin/timedatectl"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
LABEL = r"[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
HOST_RE = re.compile(LABEL + r"(\." + LABEL + r")*")
ZONE_RE = re.compile(r"[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+){0,2}")


def tdc(*args):
    try:
        r = subprocess.run([TIMEDATECTL, *args], capture_output=True, text=True, timeout=10, env=ENV, stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r.stdout if r.returncode == 0 else None


def props():
    out = {}
    for line in (tdc("show") or "").splitlines():
        k, _, v = line.partition("=")
        out[k] = v
    return out


def zones():
    return sorted(z for z in (tdc("list-timezones") or "").split() if ZONE_RE.fullmatch(z))


@router.get("")
def status(user: str = Depends(current_user)):
    p = props()
    return {"available": bool(p), "now": int(time.time()), "timezone": p.get("Timezone", ""),
            "ntp": p.get("NTP") == "yes", "can_ntp": p.get("CanNTP") == "yes", "synced": p.get("NTPSynchronized") == "yes",
            "rtc_local": p.get("LocalRTC") == "yes", "hostname": socket.gethostname(), "zones": zones()}


def call(request, user, event, target, *args):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, *args], capture_output=True, text=True, timeout=45, env=ENV,
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The helper took too long to answer")
    audit(user, request.client.host, event, target=target, ok=(r.returncode == 0), **({} if r.returncode == 0 else {"error": (r.stderr or r.stdout).strip()[:200]}))
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The helper failed")[:300])
    return status(user)


class Zone(BaseModel):
    timezone: str = Field(min_length=1, max_length=64, pattern=ZONE_RE.pattern)


class Ntp(BaseModel):
    ntp: Literal["on", "off"]


class Host(BaseModel):
    hostname: str = Field(min_length=1, max_length=253)


@router.post("/timezone")
def set_zone(body: Zone, request: Request, user: str = Depends(current_user)):
    return call(request, user, "clock_timezone", body.timezone, "timezone", body.timezone)


@router.post("/ntp")
def set_ntp(body: Ntp, request: Request, user: str = Depends(current_user)):
    return call(request, user, "clock_ntp", body.ntp, "ntp", body.ntp)


@router.post("/hostname")
def set_host(body: Host, request: Request, user: str = Depends(current_user)):
    name = body.hostname.strip().lower()
    if not HOST_RE.fullmatch(name):
        raise HTTPException(400, "A hostname uses lower-case letters, digits and hyphens, in parts of up to 63 characters")
    return call(request, user, "clock_hostname", name, "hostname", name)
