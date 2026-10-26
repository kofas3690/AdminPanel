import re, subprocess, threading, time, uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/updates")

HELPER = "/usr/local/sbin/adminpanel-apt"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
STAMP = Path("/var/lib/apt/periodic/update-success-stamp")
MAX_LINES = 20000

lock = threading.Lock()
jobs = {"current": None}

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


def runner(j, kind):
    try:
        p = subprocess.Popen(
            ["/usr/bin/sudo", "-n", HELPER, kind],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL, text=True, errors="replace", env=ENV,
        )
        for line in p.stdout:
            with lock:
                if len(j["lines"]) < MAX_LINES:
                    j["lines"].append(line.rstrip())
                elif not j["truncated"]:
                    j["truncated"] = True
                    j["lines"].append("[output truncated]")
        rc = p.wait()
    except Exception as e:
        rc = -1
        with lock:
            j["lines"].append(f"[panel error: {e}]")
    with lock:
        j["returncode"] = rc
        j["status"] = "done" if rc == 0 else "failed"
    audit(j["user"], j["ip"], "apt_finished", kind=kind, returncode=rc)


@router.post("/run/{kind}")
def start(kind: str, request: Request, user: str = Depends(current_user)):
    if kind not in ("update", "upgrade"):
        raise HTTPException(404, "Unknown action")
    with lock:
        cur = jobs["current"]
        if cur and cur["status"] == "running":
            raise HTTPException(409, "A job is already running")
        j = {
            "id": uuid.uuid4().hex[:8], "kind": kind, "status": "running",
            "returncode": None, "lines": [], "truncated": False,
            "user": user, "ip": request.client.host,
        }
        jobs["current"] = j
    audit(user, request.client.host, "apt_started", kind=kind)
    threading.Thread(target=runner, args=(j, kind), daemon=True).start()
    return {"id": j["id"]}


@router.get("/job")
def job_status(since: int = 0, id: str = "", user: str = Depends(current_user)):
    with lock:
        j = jobs["current"]
        if not j:
            return {"status": "none"}
        if id != j["id"]:
            since = 0
        since = max(0, since)
        return {
            "id": j["id"], "kind": j["kind"], "status": j["status"],
            "returncode": j["returncode"], "lines": j["lines"][since:],
            "next": len(j["lines"]),
        }
