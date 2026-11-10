"""Warnings for the administrator: a disk that is filling up, memory running out, failed services.

Nothing here changes the machine. Each request looks at the machine as it is now and returns the
problems it finds, so the list is always current and there is no separate alert history to go stale.
The only stored thing is the settings (thresholds and the services the person chose to mute).
"""
import json, socket, threading, time
import psutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import current_user
from audit import audit
from store import PersistentDict
import units
import mailer
import smart
import certs
import reboot

router = APIRouter(prefix="/api/alerts")
store = PersistentDict("alert_settings")

DEFAULTS = {"disk_warn": 85, "disk_crit": 95, "mem_warn": 90, "muted": []}
SKIP_FS = {"squashfs", "tmpfs", "devtmpfs", "overlay", "iso9660", "ramfs"}
ORDER = {"critical": 0, "warning": 1}


def settings():
    s = dict(DEFAULTS)
    s.update(store.get("cfg") or {})
    return s


def disk_alerts(cfg):
    out, seen = [], set()
    for p in psutil.disk_partitions(all=False):
        if p.fstype in SKIP_FS or p.device in seen or p.mountpoint.startswith(("/snap", "/boot/efi")):
            continue
        seen.add(p.device)
        try:
            u = psutil.disk_usage(p.mountpoint)
        except OSError:
            continue
        sev = "critical" if u.percent >= cfg["disk_crit"] else "warning" if u.percent >= cfg["disk_warn"] else None
        if sev:
            out.append({"id": "disk:" + p.mountpoint, "severity": sev, "kind": "disk",
                        "title": f"{p.mountpoint} is {u.percent:.0f}% full",
                        "detail": f"{(u.total - u.used) / 1e9:.1f} GB free of {u.total / 1e9:.1f} GB on {p.device}.",
                        "link": "/storage.html"})
    return out


def memory_alerts(cfg):
    m = psutil.virtual_memory()
    if m.percent < cfg["mem_warn"]:
        return []
    return [{"id": "memory", "severity": "warning", "kind": "memory",
             "title": f"Memory is {m.percent:.0f}% used",
             "detail": f"{m.available / 1e6:.0f} MB available of {m.total / 1e6:.0f} MB.",
             "link": "/units.html"}]


def failed_alerts(cfg):
    try:
        r = units.sc("--failed", "--no-pager", "--plain", "--output=json")
        rows = json.loads(r.stdout or "[]") if r.returncode == 0 else []
    except (HTTPException, ValueError):
        rows = []
    out = []
    for u in rows:
        name = u.get("unit") or ""
        if not units.UNIT_RE.fullmatch(name):
            continue
        out.append({"id": "unit:" + name, "severity": "critical" if name.endswith(".service") else "warning",
                    "kind": "unit", "unit": name, "muted": name in cfg["muted"],
                    "title": f"{name} has failed",
                    "detail": (u.get("description") or "") + (" (" + u["sub"] + ")" if u.get("sub") else ""),
                    "link": "/units.html"})
    return out


def smart_alerts(cfg):
    """Disks whose own health report says they are failing or showing warning signs (from the hourly reading)."""
    d = smart.cached() or {}
    out = []
    for x in d.get("disks", []):
        if x.get("status") not in ("failing", "warning"):
            continue
        bad = x["status"] == "failing"
        out.append({"id": "smart:" + x["device"], "severity": "critical" if bad else "warning", "kind": "disk-health",
                    "title": f"Disk {x['device']} " + ("is failing" if bad else "shows warning signs"),
                    "detail": " ".join(x.get("reasons", []))[:300] + (" Back up its data now." if bad else ""),
                    "link": "/storage.html#health"})
    return out


def cert_alerts(cfg):
    """Certificates that have expired or will soon (from the hourly reading)."""
    d = certs.cached() or {}
    now = int(time.time())
    out = []
    for c in certs.annotate(d, now):
        if c["status"] == "ok":
            continue
        name = (c.get("names") or [c.get("subject", "certificate")])[0]
        if name.startswith("CN="):
            name = name[3:].split(",")[0]
        if c["status"] == "expired":
            title, detail = f"Certificate for {name} has expired", "Visitors and other machines will see certificate errors."
        else:
            n = c["days_left"]
            title = f"Certificate for {name} expires " + ("today" if n < 1 else f"in {n} day" + ("" if n == 1 else "s"))
            detail = "Renew it before then."
        out.append({"id": "cert:" + c["fp"][:16], "severity": "warning" if c["status"] == "warning" else "critical",
                    "kind": "certificate", "title": title, "detail": detail + " File: " + c["path"], "link": "/certs.html"})
    return out


def reboot_alerts(cfg):
    """A reboot that has been waiting for more than a week (the pending update is not fully in effect until then)."""
    d = reboot.info()
    if not d["required"] or d["days"] is None or d["days"] < reboot.OVERDUE_DAYS:
        return []
    pk = (" Because of: " + ", ".join(d["packages"][:5]) + ".") if d["packages"] else ""
    return [{"id": "reboot-required", "severity": "warning", "kind": "reboot",
             "title": f"A reboot has been waiting for {d['days']} days",
             "detail": "Updates are installed but not fully in effect until the machine restarts." + pk,
             "link": "/updates.html"}]


def scan():
    cfg = settings()
    found = disk_alerts(cfg) + memory_alerts(cfg) + failed_alerts(cfg) + smart_alerts(cfg) + cert_alerts(cfg) + reboot_alerts(cfg)
    active = [a for a in found if not a.get("muted")]
    active.sort(key=lambda a: (ORDER[a["severity"]], a["title"]))
    return cfg, active, [a for a in found if a.get("muted")]


@router.get("")
def current(user: str = Depends(current_user)):
    cfg, active, muted = scan()
    return {"alerts": active, "muted_active": muted, "settings": cfg,
            "critical": sum(a["severity"] == "critical" for a in active),
            "warning": sum(a["severity"] == "warning" for a in active)}


class Body(BaseModel):
    disk_warn: int
    disk_crit: int
    mem_warn: int
    muted: List[str] = []


@router.put("/settings")
def save(body: Body, request: Request, user: str = Depends(current_user)):
    if not (50 <= body.disk_warn <= 99) or not (51 <= body.disk_crit <= 100) or body.disk_warn >= body.disk_crit:
        raise HTTPException(400, "Disk: warning must be 50 to 99 and lower than critical (up to 100)")
    if not (50 <= body.mem_warn <= 100):
        raise HTTPException(400, "Memory warning must be between 50 and 100")
    muted = sorted({u for u in body.muted if units.UNIT_RE.fullmatch(u)})
    if len(muted) != len(set(body.muted)) or len(muted) > 100:
        raise HTTPException(400, "Invalid service name in the muted list")
    cfg = {"disk_warn": body.disk_warn, "disk_crit": body.disk_crit, "mem_warn": body.mem_warn, "muted": muted}
    store["cfg"] = cfg
    audit(user, request.client.host, "alert_settings", **{k: v for k, v in cfg.items() if k != "muted"}, muted=len(muted))
    return cfg


# ---- email -------------------------------------------------------------------------------------

notified = PersistentDict("alert_notified")     # "id|severity" -> time first mailed
CHECK_EVERY = 120                               # seconds between checks while email is on


class MailBody(BaseModel):
    enabled: bool
    host: str = ""
    port: int = 587
    security: str = "starttls"
    username: str = ""
    sender: str = ""
    to: List[str] = []
    password: Optional[str] = None              # empty or missing keeps the saved password


def mail_view():
    c = mailer.get()
    return {**c, "has_password": mailer.has_password()}


@router.get("/email")
def mail_get(user: str = Depends(current_user)):
    return mail_view()


@router.put("/email")
def mail_save(body: MailBody, request: Request, user: str = Depends(current_user)):
    c = {"enabled": body.enabled, "host": body.host.strip(), "port": body.port, "security": body.security,
         "username": body.username.strip(), "sender": body.sender.strip(),
         "to": [a.strip() for a in body.to if a.strip()]}
    pw = body.password or None
    try:
        mailer.validate(c, pw)
    except mailer.MailError as e:
        raise HTTPException(400, str(e))
    if pw is not None:
        mailer.set_password(pw)
    if not c["enabled"] or c["host"] != mailer.get()["host"]:
        for k, _ in notified.items():
            del notified[k]                     # a new setup starts fresh and reports what exists now
    mailer.store["cfg"] = c
    audit(user, request.client.host, "alert_email_settings", enabled=c["enabled"], host=c["host"],
          port=c["port"], to=len(c["to"]), password_changed=pw is not None)
    return mail_view()


@router.post("/email/test")
def mail_test(request: Request, user: str = Depends(current_user)):
    try:
        mailer.send("AdminPanel test message from " + socket.gethostname(),
                    "This is a test message from the AdminPanel on " + socket.gethostname() +
                    ".\nIf you can read it, alert emails will reach you.\n")
    except mailer.MailError as e:
        audit(user, request.client.host, "alert_email_test_failed", error=str(e)[:200])
        raise HTTPException(400, str(e))
    audit(user, request.client.host, "alert_email_test")
    return {"ok": True}


def notify_once():
    """One check: mail anything new (and anything that has cleared) since the last mail. Returns True if mailed."""
    c = mailer.get()
    if not c["enabled"]:
        return False
    cfg, active, _ = scan()
    now = {a["id"] + "|" + a["severity"]: a for a in active}
    before = dict(notified.items())
    new = [a for k, a in now.items() if k not in before]
    gone = [k for k in before if k not in now]
    if not new and not gone:
        return False
    host = socket.gethostname()
    lines = []
    if new:
        lines.append("New problems on " + host + ":")
        lines += ["  [" + a["severity"].upper() + "] " + a["title"] + (" - " + a["detail"] if a["detail"] else "") for a in new]
    if gone:
        lines += ["", "No longer a problem:"] + ["  " + str((before[k] or {}).get("title") or k.split("|")[0]) for k in gone]
    lines += ["", "Open the Alerts page of the AdminPanel for details."]
    subject = f"[{host}] " + (f"{len(new)} new alert" + ("s" if len(new) != 1 else "") if new else "alerts cleared")
    mailer.send(subject, "\n".join(lines) + "\n", c)
    for k in gone:
        del notified[k]
    for k in now:
        if k not in before:
            notified[k] = {"t": int(time.time()), "title": now[k]["title"]}
    return True


def watcher():
    failing = False
    time.sleep(30)
    while True:
        try:
            notify_once()
            failing = False
        except Exception as e:                  # keep the loop alive whatever happens
            if not failing:                     # one audit line per run of failures, not one per check
                audit("system", "-", "alert_email_failed", error=str(e)[:200])
            failing = True
        time.sleep(CHECK_EVERY)


def start_watcher():
    threading.Thread(target=watcher, name="alert-mail", daemon=True).start()
