"""Login history: who signed in to this machine, and who tried and failed.

Both lists are read only. Successful logins come from the system's own login record (`last`, which reads
/var/log/wtmp); failed SSH attempts come from the journal. Failed attempts are grouped by source address,
so a password-guessing run shows up as one line with a count instead of hundreds of lines.
"""
import json, re, subprocess, time
from datetime import datetime
import psutil
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user
import journal

LAST = "/usr/bin/last"
router = APIRouter(prefix="/api/logins")

ISO = r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d"
ISO_RE = re.compile(ISO)
RANGES = {"24h": "--since=-24h", "7d": "--since=-7d", "30d": "--since=-30d"}
FAILED = [
    re.compile(r"Failed (?:password|publickey|keyboard-interactive/pam) for (?:invalid user )?(\S+) from (\S+) port"),
    re.compile(r"Invalid user (\S*) from (\S+)"),
]


def to_epoch(s):
    try:
        return int(datetime.fromisoformat(s).timestamp())
    except ValueError:
        return None


def parse_last(text):
    rows = []
    for line in text.splitlines():
        m = ISO_RE.search(line)
        if not m or line.startswith(("wtmp begins", "btmp begins")):
            continue
        head = line[:m.start()].split()
        if len(head) < 2:
            continue
        rest = line[m.end():].strip()
        end, state = None, ""
        m2 = ISO_RE.match(rest.lstrip("- ").strip())
        if rest.startswith("still logged in"):
            state = "active"
        elif m2:
            end = to_epoch(m2.group(0))
        elif rest.startswith("gone"):
            state = "gone"
        elif re.match(r"-\s*(crash|down)", rest):
            state = re.match(r"-\s*(crash|down)", rest).group(1)
        rows.append({"user": head[0], "tty": head[1], "host": " ".join(head[2:]), "start": to_epoch(m.group(0)),
                     "end": end, "state": state or ("ended" if end else "")})
    return rows


@router.get("/sessions")
def sessions(limit: int = 200, user: str = Depends(current_user)):
    limit = max(10, min(limit, 1000))
    try:
        r = subprocess.run([LAST, "-w", "-F", "--time-format", "iso", "-n", str(limit)], capture_output=True,
                           encoding="utf-8", errors="replace", timeout=15, env=journal.ENV, stdin=subprocess.DEVNULL)
    except FileNotFoundError:
        raise HTTPException(500, "The 'last' command is not installed (sudo apt install util-linux)")
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Reading the login record took too long")
    if r.returncode != 0 and not r.stdout:
        raise HTTPException(500, "Could not read the login record: " + (r.stderr or "").strip()[:150])
    history = [x for x in parse_last(r.stdout) if x["tty"] != "system"]
    now = []
    for u in psutil.users():
        now.append({"user": u.name, "tty": u.terminal or "", "host": u.host or "", "start": int(u.started)})
    return {"now": now, "history": history}


@router.get("/failed")
def failed(rng: str = "24h", user: str = Depends(current_user)):
    if rng not in RANGES:
        raise HTTPException(400, "Invalid range")
    try:
        r = subprocess.run([journal.JOURNALCTL, "--no-pager", "-o", "json", RANGES[rng], "-t", "sshd", "-t", "sshd-session",
                            "-n", "20000"], capture_output=True, encoding="utf-8", errors="replace", timeout=30,
                           env=journal.ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Reading the journal took too long")
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or "journalctl failed").strip()[:200])
    seen, attempts = set(), []
    for line in r.stdout.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        msg = journal.message(e)
        for pat in FAILED:
            m = pat.search(msg)
            if m:
                ts = int(int(e.get("__REALTIME_TIMESTAMP", "0")) / 1e6)
                key = (ts, m.group(1), m.group(2))
                if key not in seen:                      # "Invalid user" and "Failed password" describe one attempt
                    seen.add(key)
                    attempts.append({"t": ts, "user": m.group(1) or "(empty)", "ip": m.group(2)})
                break
    attempts.sort(key=lambda a: -a["t"])
    groups = {}
    for a in attempts:
        g = groups.setdefault(a["ip"], {"ip": a["ip"], "count": 0, "last": a["t"], "first": a["t"], "users": {}})
        g["count"] += 1
        g["first"] = min(g["first"], a["t"])
        g["users"][a["user"]] = g["users"].get(a["user"], 0) + 1
    by_ip = []
    for g in sorted(groups.values(), key=lambda g: -g["count"])[:100]:
        users = sorted(g["users"].items(), key=lambda kv: -kv[1])
        by_ip.append({"ip": g["ip"], "count": g["count"], "first": g["first"], "last": g["last"],
                      "users": [u for u, _ in users[:5]], "more_users": max(0, len(users) - 5)})
    return {"total": len(attempts), "sources": len(groups), "by_ip": by_ip, "recent": attempts[:200]}
