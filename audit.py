import json, syslog, time
from pathlib import Path

AUDIT = Path(__file__).parent / "audit.log"


def audit(user, ip, event, **detail):
    line = json.dumps({
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "user": user, "ip": ip, "event": event, **detail,
    })
    with AUDIT.open("a") as f:
        f.write(line + "\n")
    # A second copy outside the panel's own files: the panel account cannot edit the journal.
    try:
        syslog.openlog("adminpanel-audit", 0, syslog.LOG_AUTH)
        syslog.syslog(syslog.LOG_INFO, line)
    except Exception:
        pass
