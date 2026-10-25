import subprocess
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/services")
SYSTEMCTL = "/usr/bin/systemctl"

ALLOWED = {
    "nginx": ["start", "stop", "restart"],
    "cron": ["start", "stop", "restart"],
    "ssh": ["restart"],
}


def run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=30)


@router.get("")
def list_services(user: str = Depends(current_user)):
    result = []
    for name, actions in ALLOWED.items():
        r = run([SYSTEMCTL, "show", f"{name}.service",
                 "--property=LoadState,ActiveState,SubState,Description"])
        props = dict(l.split("=", 1) for l in r.stdout.splitlines() if "=" in l)
        if props.get("LoadState") == "not-found":
            result.append({"name": name, "state": "not installed",
                           "description": "", "actions": []})
        else:
            result.append({
                "name": name,
                "state": f'{props.get("ActiveState")}/{props.get("SubState")}',
                "description": props.get("Description", ""),
                "actions": actions,
            })
    return result


@router.post("/{name}/{action}")
def act(name: str, action: str, request: Request,
        user: str = Depends(current_user)):
    if action not in ALLOWED.get(name, []):
        audit(user, request.client.host, "service_denied", service=name, action=action)
        raise HTTPException(403, "Not allowed")
    r = run(["sudo", "-n", SYSTEMCTL, action, name])
    audit(user, request.client.host, "service_action",
          service=name, action=action, ok=(r.returncode == 0))
    if r.returncode != 0:
        raise HTTPException(500, r.stderr.strip() or "Command failed")
    return {"ok": True}
