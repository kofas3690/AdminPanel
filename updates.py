import re, subprocess, threading, time
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/updates")

SUDO = "/usr/bin/sudo"
HELPER = "/usr/local/sbin/adminpanel-apt"
SYSTEMCTL = "/usr/bin/systemctl"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
STAMP = Path("/var/lib/apt/periodic/update-success-stamp")
STATE = Path("/var/lib/adminpanel")     # where the helper's job leaves its log and exit status
UNIT = "adminpanel-apt-job.service"
MAX_BYTES = 2_000_000                   # the page shows at most this much output
GRACE = 5                               # seconds after a start during which "not running yet" is normal

start_lock = threading.Lock()
started = {}                            # who started the job we know about (lost if the panel restarts)

LINE = re.compile(r"^([^/\s]+)/(\S+) (\S+) (\S+) \[upgradable from: ([^\]]+)\]")


@router.get("")
def overview(user: str = Depends(current_user)):
    r = subprocess.run(["/usr/bin/apt", "list", "--upgradable"],
                       capture_output=True, text=True, timeout=60, env=ENV)
    packages = []
    for line in r.stdout.splitlines():
        m = LINE.match(line)
        if m:
            packages.append({
                "name": m[1], "suite": m[2], "new": m[3],
                "old": m[5], "security": "-security" in m[2],
            })
    age = int(time.time() - STAMP.stat().st_mtime) if STAMP.exists() else None
    return {
        "packages": packages,
        "cache_age": age,
        "reboot_required": Path("/run/reboot-required").exists(),
    }


def read(name):
    try:
        return (STATE / name).read_text().strip()
    except OSError:
        return ""


def unit_active():
    try:
        r = subprocess.run([SYSTEMCTL, "show", "-p", "ActiveState", "--value", UNIT],
                           capture_output=True, text=True, timeout=10, env=ENV,
                           stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        return True                      # cannot tell: do not claim the job has ended
    return r.stdout.strip() in ("active", "activating", "deactivating", "reloading")


def read_log():
    """The job's output as lines. Only the first MAX_BYTES are kept, so a line's number never changes."""
    p = STATE / "apt-job.log"
    try:
        size = p.stat().st_size
        with p.open("rb") as f:
            data = f.read(MAX_BYTES)
    except OSError:
        return []
    lines = [l.rstrip("\r") for l in data.decode(errors="replace").splitlines()]
    if size > MAX_BYTES:
        lines.append("[output truncated]")
    return lines


@router.post("/run/{kind}")
def start(kind: str, request: Request, user: str = Depends(current_user)):
    if kind not in ("update", "upgrade"):
        raise HTTPException(404, "Unknown action")
    with start_lock:
        try:
            r = subprocess.run([SUDO, "-n", HELPER, kind], capture_output=True, text=True,
                               timeout=30, env=ENV, stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "The system took too long to start the job")
        if r.returncode == 3:
            raise HTTPException(409, "A job is already running")
        if r.returncode != 0:
            raise HTTPException(500, (r.stderr or r.stdout).strip()[:300] or "Could not start the job")
        jid = read("apt-job.id")
        started.clear()
        started.update(id=jid, kind=kind, user=user, ip=request.client.host, audited=False)
    audit(user, request.client.host, "apt_started", kind=kind)
    return {"id": jid}


@router.get("/job")
def job_status(since: int = 0, id: str = "", user: str = Depends(current_user)):
    jid = read("apt-job.id")
    if not jid:
        return {"status": "none"}
    kind = read("apt-job.kind")
    rc_text = read("apt-job.rc")
    if unit_active():
        status, rc = "running", None
    elif rc_text.lstrip("-").isdigit():
        rc = int(rc_text)
        status = "done" if rc == 0 else "failed"
    else:
        try:
            fresh = time.time() - (STATE / "apt-job.id").stat().st_mtime < GRACE
        except OSError:
            fresh = False
        if fresh:                        # the unit is still being created
            status, rc = "running", None
        else:                            # it stopped without leaving a status, e.g. the machine rebooted
            status, rc = "failed", -1
    lines = read_log()
    if status != "running" and started.get("id") == jid and not started.get("audited"):
        started["audited"] = True
        audit(started["user"], started["ip"], "apt_finished", kind=kind, returncode=rc)
    if id != jid:
        since = 0
    since = max(0, since)
    return {"id": jid, "kind": kind, "status": status, "returncode": rc,
            "lines": lines[since:], "next": len(lines)}
