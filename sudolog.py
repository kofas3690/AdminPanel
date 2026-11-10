"""Sudo activity: who used sudo, what they ran, and who was refused.

Read only, from the journal. sudo writes one line per use, for example
`kofi : TTY=pts/0 ; PWD=/home/kofi ; USER=root ; COMMAND=/usr/bin/apt update`, and a different shape for a wrong
password or a user who is not allowed. The panel's own account runs its root helpers through sudo many times a
minute, so those lines are hidden unless asked for: they would bury what people did.
"""
import json, re, subprocess
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user
import journal

router = APIRouter(prefix="/api/sudo")

RANGES = {"24h": "--since=-24h", "7d": "--since=-7d", "30d": "--since=-30d"}
USER_RE = re.compile(r"\s*([A-Za-z0-9._-]{1,64}) : (.*)")
INCORRECT = re.compile(r"(\d+) incorrect password attempts?")
PANEL_USERS = {"adminpanel", "adminpanel-remote"}
MAX_CMD = 400


def parse_message(msg):
    """One sudo journal message -> dict, or None for lines that are not a use of sudo (session opened, and so on)."""
    m = USER_RE.fullmatch(msg)
    if not m:
        return None
    who, rest = m.groups()
    fields, kind, attempts = {}, "ran", 0
    head, sep, command = rest.partition("COMMAND=")      # the command may itself contain " ; ", so split it off first
    if not sep:
        return None
    fields["COMMAND"] = command
    for part in head.split(" ; "):
        part = part.strip()
        if "=" in part and part.split("=", 1)[0] in ("TTY", "PWD", "USER", "TSID"):
            k, v = part.split("=", 1)
            fields[k] = v
        elif part == "user NOT in sudoers" or part.startswith("command not allowed"):
            kind = "denied"
        elif INCORRECT.fullmatch(part):
            kind, attempts = "failed", int(INCORRECT.fullmatch(part).group(1))
    return {"user": who, "kind": kind, "attempts": attempts, "tty": fields.get("TTY", ""), "pwd": fields.get("PWD", "")[:200],
            "as_user": fields.get("USER", ""), "command": fields["COMMAND"][:MAX_CMD]}


@router.get("")
def activity(rng: str = "24h", panel: bool = False, user: str = Depends(current_user)):
    if rng not in RANGES:
        raise HTTPException(400, "Invalid range")
    try:
        r = subprocess.run([journal.JOURNALCTL, "--no-pager", "-o", "json", RANGES[rng], "-t", "sudo", "-t", "sudo-rs",
                            "-n", "20000"], capture_output=True, encoding="utf-8", errors="replace", timeout=30,
                           env=journal.ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Reading the journal took too long")
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or "journalctl failed").strip()[:200])
    events, hidden = [], 0
    for line in r.stdout.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        p = parse_message(journal.message(e))
        if not p:
            continue
        if p["user"] in PANEL_USERS and not panel:
            hidden += 1
            continue
        p["t"] = int(int(e.get("__REALTIME_TIMESTAMP", "0")) / 1e6)
        events.append(p)
    events.sort(key=lambda x: -x["t"])
    by = {}
    for x in events:
        s = by.setdefault(x["user"], {"user": x["user"], "ran": 0, "refused": 0, "last": x["t"]})
        if x["kind"] == "ran":
            s["ran"] += 1
        else:
            s["refused"] += 1
    return {"total": len(events), "refused": sum(1 for x in events if x["kind"] != "ran"), "hidden_panel": hidden,
            "users": sorted(by.values(), key=lambda s: -(s["ran"] + s["refused"]))[:50], "recent": events[:300]}
