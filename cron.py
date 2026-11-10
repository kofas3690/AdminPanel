"""Cron jobs: a read-only view of what is scheduled through cron and anacron.

System files (/etc/crontab, /etc/cron.d, /etc/anacrontab, /etc/cron.hourly and friends) are read directly.
Personal crontabs are only readable by root, so a small read-only helper fetches them. Nothing here changes
a schedule; each job gets a plain-English description and its next run time.
"""
import calendar, datetime, json, os, re, subprocess
import psutil
from fastapi import APIRouter, Depends
from auth import current_user

router = APIRouter(prefix="/api/cron")

HELPER = "/usr/local/sbin/adminpanel-cron"
SUDO = "/usr/bin/sudo"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
ETC = "/etc"
NAME_RE = re.compile(r"[A-Za-z0-9_-]+")      # cron ignores file names with other characters (dots, tildes)
ENVLINE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\s*=")
MAX_FILE = 65536
MAX_CMD = 300
SPECIAL = {"@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0",
           "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *"}
MONTHS = {n.lower(): i for i, n in enumerate(calendar.month_abbr) if n}
DAYS = {"sun": 0, "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6}
MONTH_NAMES = [None] + list(calendar.month_name)[1:]
DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
RANGES = [(0, 59, {}), (0, 23, {}), (1, 31, {}), (1, 12, MONTHS), (0, 7, DAYS)]


def parse_field(spec, lo, hi, names):
    """Expand one cron field into (set of values, restricted?). Raises ValueError for anything odd."""
    vals = set()
    star = False
    for part in spec.split(","):
        step = 1
        if "/" in part:
            part, s = part.split("/", 1)
            if not s.isdigit() or int(s) < 1:
                raise ValueError("step")
            step = int(s)
        if part == "*":
            a, b = lo, hi
            star = star or step == 1
        else:
            if "-" in part:
                x, y = part.split("-", 1)
            else:
                x = y = part
            def num(t):
                t = t.lower()
                if t in names:
                    return names[t]
                if t.isdigit():
                    return int(t)
                raise ValueError("value")
            a, b = num(x), num(y)
            if "-" not in part and step > 1:
                b = hi
        if a < lo or b > hi or a > b:
            raise ValueError("range")
        vals.update(range(a, b + 1, step))
    return vals, star


def parse_schedule(five):
    """five: list of 5 strings -> dict of sets plus flags, or raises ValueError."""
    fields = []
    for spec, (lo, hi, names) in zip(five, RANGES):
        v, star = parse_field(spec, lo, hi, names)
        fields.append((v, star))
    dows = {d % 7 for d in fields[4][0]}
    return {"min": fields[0][0], "hour": fields[1][0], "dom": fields[2][0], "mon": fields[3][0], "dow": dows,
            "dom_star": fields[2][1], "dow_star": fields[4][1]}


def day_ok(s, d):
    dom = d.day in s["dom"]
    dow = (d.weekday() + 1) % 7 in s["dow"]
    if s["dom_star"] and s["dow_star"]:
        return True
    if s["dom_star"]:
        return dow
    if s["dow_star"]:
        return dom
    return dom or dow          # when both are restricted, cron runs on either


def next_run(s, now):
    """The first minute strictly after `now` that matches, within about five years; None if there is none."""
    t = now.replace(second=0, microsecond=0) + datetime.timedelta(minutes=1)
    day = t.date()
    for i in range(366 * 5):
        d = day + datetime.timedelta(days=i)
        if d.month not in s["mon"] or not day_ok(s, d):
            continue
        for h in sorted(s["hour"]):
            for m in sorted(s["min"]):
                c = datetime.datetime.combine(d, datetime.time(h, m))
                if c >= t:
                    return c
    return None


def _list(vals, fmt=str, word="and"):
    v = [fmt(x) for x in sorted(vals)]
    return v[0] if len(v) == 1 else ", ".join(v[:-1]) + " " + word + " " + v[-1]


def describe(five, special=None):
    """A short plain-English reading of the schedule."""
    if special == "@reboot":
        return "At startup"
    try:
        s = parse_schedule(five)
    except ValueError:
        return "Schedule not understood"
    mi, ho = five[0], five[1]
    if mi == "*" and ho == "*":
        when = "Every minute"
    elif mi.startswith("*/") and ho == "*" and mi[2:].isdigit():
        when = "Every %s minutes" % mi[2:]
    elif ho == "*" and len(s["min"]) == 1:
        when = "At minute %d of every hour" % next(iter(s["min"]))
    elif len(s["min"]) * len(s["hour"]) <= 4 and "*" not in mi + ho and "/" not in mi + ho:
        when = "At " + _list([(h, m) for h in s["hour"] for m in s["min"]], lambda x: "%02d:%02d" % x)
    elif ho.startswith("*/") and len(s["min"]) == 1:
        when = "At minute %d past every %s hours" % (next(iter(s["min"])), ho[2:])
    else:
        when = "At minute %s, hour %s" % (mi, ho)
    parts = []
    if len(s["dom"]) < 31 and not s["dom_star"]:
        parts.append("on day %s of the month" % _list(s["dom"]))
    if len(s["dow"]) < 7 and not s["dow_star"]:
        dw = sorted(s["dow"])
        if len(dw) > 2 and dw == list(range(dw[0], dw[-1] + 1)):
            parts.append("on %s to %s" % (DAY_NAMES[dw[0]], DAY_NAMES[dw[-1]]))
        else:
            parts.append("on " + _list(s["dow"], lambda d: DAY_NAMES[d]))
    if len(s["mon"]) < 12:
        parts.append("in " + _list(s["mon"], lambda m: MONTH_NAMES[m]))
    if not parts and not when.startswith("Every") and "every hour" not in when:
        when += " every day"
    both = not s["dom_star"] and not s["dow_star"] and len(parts) >= 2
    return when + (" " + ((" or ".join(parts[:2]) + " " + " ".join(parts[2:])).strip() if both else " ".join(parts)) if parts else "")


def job(source, five, user, command, special=None, now=None):
    now = now or datetime.datetime.now()
    row = {"source": source, "user": user, "command": command[:MAX_CMD], "schedule": " ".join(five) if not special else special,
           "when": describe(five, special), "next": None}
    if special != "@reboot":
        try:
            n = next_run(parse_schedule(five), now)
            row["next"] = int(n.timestamp()) if n else None
        except ValueError:
            pass
    return row


def parse_lines(lines, source, has_user, default_user="", now=None):
    jobs = []
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or ENVLINE.match(line):
            continue
        special = None
        if line.startswith("@"):
            parts = line.split(None, 2 if has_user else 1)
            special = parts[0].lower()
            if special != "@reboot" and special not in SPECIAL:
                continue
            five, rest = (SPECIAL.get(special) or "* * * * *").split(), parts[1:]
        else:
            parts = line.split(None, 6 if has_user else 5)
            if len(parts) < (7 if has_user else 6):
                continue
            five, rest = parts[:5], parts[5:]
        if has_user:
            if len(rest) < 2:
                continue
            user, cmd = rest[0], rest[1]
        else:
            if not rest:
                continue
            user, cmd = default_user, rest[0]
        jobs.append(job(source, five, user, cmd, special, now))
    return jobs


def read_text(path):
    try:
        if os.path.islink(path) or not os.path.isfile(path):
            return None
        with open(path, "r", errors="replace") as f:
            return f.read(MAX_FILE).splitlines()
    except OSError:
        return None


def system_jobs(now=None):
    jobs = []
    lines = read_text(os.path.join(ETC, "crontab"))
    if lines is not None:
        jobs += parse_lines(lines, "/etc/crontab", True, now=now)
    d = os.path.join(ETC, "cron.d")
    try:
        names = sorted(os.listdir(d))
    except OSError:
        names = []
    for n in names:
        if not NAME_RE.fullmatch(n):
            continue
        lines = read_text(os.path.join(d, n))
        if lines is not None:
            jobs += parse_lines(lines, "/etc/cron.d/" + n, True, now=now)
    return jobs


def anacron_jobs():
    out = []
    for raw in read_text(os.path.join(ETC, "anacrontab")) or []:
        line = raw.strip()
        if not line or line.startswith("#") or ENVLINE.match(line):
            continue
        p = line.split(None, 3)
        if len(p) < 4:
            continue
        period = {"@daily": "Every day", "@weekly": "Every week", "@monthly": "Every month"}.get(p[0].lower())
        if period is None:
            period = ("Every day" if p[0] == "1" else "Every %s days" % p[0]) if p[0].isdigit() else "Periodically"
        out.append({"period": period, "delay": p[1], "id": p[2][:64], "command": p[3][:MAX_CMD]})
    return out


def run_parts():
    out = []
    for kind in ("hourly", "daily", "weekly", "monthly"):
        d = os.path.join(ETC, "cron." + kind)
        try:
            names = sorted(os.listdir(d))
        except OSError:
            continue
        for n in names:
            p = os.path.join(d, n)
            if NAME_RE.fullmatch(n) and os.path.isfile(p):
                out.append({"kind": kind, "name": n, "runs": os.access(p, os.X_OK)})
    return out


def personal_jobs(now=None):
    """(jobs, note). The note explains why personal crontabs are missing, if they are."""
    if not os.path.exists(HELPER):
        return [], "Personal crontabs could not be read (the helper is not installed)."
    try:
        r = subprocess.run([SUDO, "-n", HELPER, "list"], capture_output=True, text=True, timeout=20, env=ENV,
                           stdin=subprocess.DEVNULL)
        if r.returncode != 0:
            raise ValueError
        data = json.loads(r.stdout)
    except (subprocess.TimeoutExpired, ValueError, OSError):
        return [], "Personal crontabs could not be read right now."
    jobs = []
    for ct in data.get("crontabs", []):
        jobs += parse_lines(ct.get("lines", []), "crontab of " + ct["user"], False, ct["user"], now=now)
    return jobs, ""


@router.get("")
def overview(user: str = Depends(current_user)):
    now = datetime.datetime.now()
    pj, note = personal_jobs(now)
    jobs = system_jobs(now) + pj
    cron_running = any(p.info["name"] in ("cron", "crond") for p in psutil.process_iter(["name"]))
    return {"now": int(now.timestamp()), "jobs": jobs, "anacron": anacron_jobs(), "scripts": run_parts(),
            "note": note, "cron_running": cron_running}
