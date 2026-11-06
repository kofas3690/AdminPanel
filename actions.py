"""Actions that change or read this machine, written so that both the panel and `bridge.py` can call them.

Standard library only. Nothing here knows about web requests or about SSH; it takes plain values,
checks them, and either returns a result or raises ActionError(status, message).
"""
import subprocess

SYSTEMCTL = "/usr/bin/systemctl"

ALLOWED = {
    "nginx": ["start", "stop", "restart"],
    "cron": ["start", "stop", "restart"],
    "ssh": ["restart"],
}


class ActionError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def _run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=30)


def list_services():
    result = []
    for name, actions in ALLOWED.items():
        r = _run([SYSTEMCTL, "show", f"{name}.service",
                  "--property=LoadState,ActiveState,SubState,Description"])
        props = dict(l.split("=", 1) for l in r.stdout.splitlines() if "=" in l)
        if props.get("LoadState") == "not-found":
            result.append({"name": name, "state": "not installed", "description": "", "actions": []})
        else:
            result.append({
                "name": name,
                "state": f'{props.get("ActiveState")}/{props.get("SubState")}',
                "description": props.get("Description", ""),
                "actions": actions,
            })
    return result


def act_service(name, action):
    """Starts, stops or restarts one of the allowed services. Returns True, or raises ActionError."""
    if not isinstance(name, str) or not isinstance(action, str) or action not in ALLOWED.get(name, []):
        raise ActionError(403, "Not allowed")
    r = _run(["sudo", "-n", SYSTEMCTL, action, name])
    if r.returncode != 0:
        raise ActionError(500, r.stderr.strip() or "Command failed")
    return True
