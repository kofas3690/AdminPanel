"""Startup: how long the last boot took, which services were slowest, and which services have failed.

Read only. systemd-analyze and systemctl show this to any account, so no root helper is needed.
"""
import re, subprocess
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api/startup")

ANALYZE = "/usr/bin/systemd-analyze"
SYSTEMCTL = "/usr/bin/systemctl"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
CTRL = re.compile(r"[\x00-\x1f\x7f]")
DUR = re.compile(r"(\d+(?:\.\d+)?)(ms|us|min|s|h|d)")
UNIT = re.compile(r"[A-Za-z0-9:_.@\\-]{1,200}\.(?:service|socket|timer|mount|target|path|device|slice|scope|swap|automount)")
FACTOR = {"us": 0.000001, "ms": 0.001, "s": 1, "min": 60, "h": 3600, "d": 86400}
MAX = 30


def run(*args, timeout=20):
    try:
        r = subprocess.run(list(args), capture_output=True, text=True, errors="replace", timeout=timeout,
                           env=ENV, stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r


def seconds(text):
    """'1min 5.2s' -> 65.2"""
    total, found = 0.0, False
    for num, unit in DUR.findall(text or ""):
        total += float(num) * FACTOR[unit]
        found = True
    return round(total, 3) if found else None


def parse_time(text):
    """Pull the parts out of 'Startup finished in 3.2s (kernel) + 12.4s (userspace) = 15.6s'."""
    out = {"kernel": None, "initrd": None, "userspace": None, "total": None}
    line = next((l for l in text.splitlines() if "Startup finished" in l), "")
    body = line.split(" in ", 1)[-1]
    for part in body.split("+"):
        m = re.search(r"([0-9.a-z ]+?)\s*\((kernel|initrd|userspace)\)", part)
        if m:
            out[m.group(2)] = seconds(m.group(1))
    m = re.search(r"=\s*([0-9.a-z ]+)$", body.strip())
    if m:
        out["total"] = seconds(m.group(1))
    return out


def parse_blame(text):
    rows = []
    for line in text.splitlines():
        m = re.match(r"\s*([0-9.a-z ]+?)\s+(\S+)\s*$", line)
        if not m or not UNIT.fullmatch(m.group(2)):
            continue
        s = seconds(m.group(1))
        if s is not None:
            rows.append({"unit": m.group(2), "seconds": s})
    return rows[:MAX]


def parse_failed(text):
    rows = []
    for line in text.splitlines():
        f = line.replace("●", " ").split(None, 4)
        if len(f) >= 4 and UNIT.fullmatch(f[0]):
            rows.append({"unit": f[0], "active": CTRL.sub("", f[2])[:20], "sub": CTRL.sub("", f[3])[:20],
                         "description": CTRL.sub("", f[4] if len(f) > 4 else "")[:200]})
    return rows


@router.get("")
def startup(user: str = Depends(current_user)):
    t = run(ANALYZE, "time", "--no-pager")
    b = run(ANALYZE, "blame", "--no-pager", timeout=30)
    f = run(SYSTEMCTL, "--failed", "--plain", "--no-legend", "--no-pager")
    timing = parse_time(t.stdout) if t and t.returncode == 0 else None
    note = ""
    if timing is None:
        err = (t.stderr if t else "") or "systemd-analyze is not available"
        note = CTRL.sub("", err.strip().splitlines()[-1] if err.strip() else "")[:200]
    return {"timing": timing, "note": note,
            "slowest": parse_blame(b.stdout) if b and b.returncode == 0 else [],
            "failed": parse_failed(f.stdout) if f and f.returncode == 0 else []}
