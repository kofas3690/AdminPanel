"""Processes: a live list of what is running, and a way to end an ordinary process.

Listing is read only (psutil). Ending a process goes through a root helper that applies its own rules:
processes owned by root or by the panel, and core system processes, are refused.
"""
import os, subprocess, time
import psutil
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Literal
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/processes")

HELPER = "/usr/local/sbin/adminpanel-proc"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
PROTECTED_NAMES = {"systemd", "sshd", "sshd-session", "dbus-daemon", "systemd-logind", "systemd-journal", "init"}
PROTECTED_USERS = {"adminpanel", "root"}
MAX_ROWS = 1500
NCPU = psutil.cpu_count() or 1
_known = {}            # (pid, start ticks) -> Process, so cpu_percent() measures the time since the last refresh


class Signal(BaseModel):
    pid: int = Field(gt=1, lt=4194305)
    started: int = Field(ge=0)
    signal: Literal["TERM", "KILL"]
    name: str = Field(default="", max_length=64)


def start_ticks(pid):
    """Start time of a process in clock ticks since boot (the value the helper checks), or None."""
    try:
        with open(f"/proc/{pid}/stat", "rb") as f:
            raw = f.read().decode("utf-8", "replace")
        return int(raw[raw.rindex(")") + 2:].split()[19])
    except (OSError, ValueError, IndexError):
        return None


def snapshot():
    rows, seen, counts = [], set(), {"running": 0, "sleeping": 0, "stopped": 0, "zombie": 0, "other": 0}
    for pid in psutil.pids():
        st = start_ticks(pid)
        if st is None:
            continue
        key = (pid, st)
        seen.add(key)
        p = _known.get(key)
        if p is None:
            try:
                p = _known[key] = psutil.Process(pid)
                p.cpu_percent(None)
            except psutil.Error:
                continue
        try:
            with p.oneshot():
                name, status, ppid = p.name(), p.status(), p.ppid()
                cpu = p.cpu_percent(None)
                try:
                    user = p.username()
                except (KeyError, psutil.Error):
                    user = str(p.uids().real)
                mem = p.memory_info().rss
                threads = p.num_threads()
                try:
                    cmd = " ".join(p.cmdline())[:300]
                except psutil.Error:
                    cmd = ""
                born = int(p.create_time())
        except psutil.Error:
            continue
        kind = {"running": "running", "sleeping": "sleeping", "disk-sleep": "sleeping", "idle": "sleeping",
                "stopped": "stopped", "tracing-stop": "stopped", "zombie": "zombie"}.get(status, "other")
        counts[kind] += 1
        kernel = not cmd and status != "zombie"            # kernel threads have no command line
        protected = (user in PROTECTED_USERS or user == "root" or name in PROTECTED_NAMES or kernel
                     or pid == os.getpid() or status == "zombie")
        rows.append({"pid": pid, "name": name, "user": user, "cpu": round(cpu, 1), "mem": mem, "state": status,
                     "threads": threads, "ppid": ppid, "t": born, "st": st, "cmd": cmd or "[" + name + "]",
                     "protected": protected})
    for k in [k for k in _known if k not in seen]:
        del _known[k]
    rows.sort(key=lambda r: (-r["cpu"], -r["mem"]))
    return {"rows": rows[:MAX_ROWS], "total": len(rows), "counts": counts, "ncpu": NCPU,
            "mem_total": psutil.virtual_memory().total, "load": [round(x, 2) for x in os.getloadavg()],
            "now": int(time.time())}


@router.get("")
def processes(user: str = Depends(current_user)):
    return snapshot()


@router.post("/signal")
def send_signal(body: Signal, request: Request, user: str = Depends(current_user)):
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "signal", str(body.pid), str(body.started), body.signal],
                           capture_output=True, text=True, timeout=20, env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The helper took too long to answer")
    audit(user, request.client.host, "process_signal", target=str(body.pid), ok=(r.returncode == 0),
          signal=body.signal, name=body.name)
    if r.returncode != 0:
        raise HTTPException(400, ((r.stderr or r.stdout).strip() or "The helper failed")[:300])
    return {"ok": True}
