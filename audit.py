import json, time
from pathlib import Path

AUDIT = Path(__file__).parent / "audit.log"


def audit(user, ip, event, **detail):
    line = json.dumps({
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "user": user, "ip": ip, "event": event, **detail,
    })
    with AUDIT.open("a") as f:
        f.write(line + "\n")
