import json, re, subprocess
from fastapi import APIRouter, Depends, HTTPException
from auth import current_user

router = APIRouter(prefix="/api/journal")

JOURNALCTL = "/usr/bin/journalctl"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
NAME_RE = re.compile(r"[A-Za-z0-9_](?:[A-Za-z0-9:_.@-]|\\x[0-9a-f]{2}){0,200}")
CURSOR_RE = re.compile(r"[A-Za-z0-9=;_.:-]{1,400}")
RANGES = {"1h": ["--since=-1h"], "6h": ["--since=-6h"], "24h": ["--since=-24h"],
          "7d": ["--since=-7d"], "boot": ["--boot"], "prevboot": ["--boot=-1"], "all": []}


def message(e):
    m = e.get("MESSAGE")
    if isinstance(m, list):
        try:
            return bytes(m).decode("utf-8", "replace")
        except Exception:
            return "[binary data]"
    return m if isinstance(m, str) else "[no text]"


@router.get("")
def entries(lines: int = 200, rng: str = "boot", priority: int = -1, unit: str = "",
            q: str = "", after: str = "", user: str = Depends(current_user)):
    args = [JOURNALCTL, "--no-pager", "-o", "json", "-n", str(max(10, min(lines, 1000)))]
    if after:
        if not CURSOR_RE.fullmatch(after):
            raise HTTPException(400, "Invalid cursor")
        args.append(f"--after-cursor={after}")
    else:
        if rng not in RANGES:
            raise HTTPException(400, "Invalid time range")
        args += RANGES[rng]
    if 0 <= priority <= 7:
        args += ["-p", str(priority)]
    elif priority != -1:
        raise HTTPException(400, "Invalid priority")
    unit = unit.strip()
    if unit == "kernel":
        args.append("-k")
    elif unit:
        if not NAME_RE.fullmatch(unit):
            raise HTTPException(400, "Invalid unit name")
        args += ["-u", unit]
    q = q.strip()
    if q:
        if len(q) > 100 or any(ord(ch) < 32 for ch in q):
            raise HTTPException(400, "Invalid search text")
        args += [f"--grep={re.escape(q)}", "--case-sensitive=false"]
    try:
        r = subprocess.run(args, capture_output=True, encoding="utf-8", errors="replace",
                           timeout=25, env=ENV, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The search took too long. Try a shorter time range.")
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or "journalctl failed").strip()[:200])

    out, cursor = [], after
    for line in r.stdout.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        try:
            prio = int(e.get("PRIORITY", 6))
        except (TypeError, ValueError):
            prio = 6
        out.append({
            "t": int(e.get("__REALTIME_TIMESTAMP", 0) or 0) // 1000,
            "p": prio if 0 <= prio <= 7 else 6,
            "u": e.get("_SYSTEMD_UNIT") or e.get("SYSLOG_IDENTIFIER") or "",
            "m": message(e)[:4000],
        })
        cursor = e.get("__CURSOR") or cursor
    return {"entries": out, "cursor": cursor}
