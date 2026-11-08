"""Reboot and shut down this machine from the Overview page.

Two things make it hard to do by accident: the caller must type the machine's own name, and nothing
happens while a software update (apt or dpkg) is running, because stopping one half way can leave
packages broken. The attempt is written to the audit log first, and the command runs only after the
answer has been sent, since the panel stops with the machine.
"""
import socket, subprocess
import psutil
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/power")

SUDO = "/usr/bin/sudo"
SYSTEMCTL = "/usr/bin/systemctl"
ACTIONS = {"reboot": "reboot", "poweroff": "poweroff"}
BUSY = {"apt", "apt-get", "dpkg", "unattended-upgr"}      # process names that mean an update is running


class PowerBody(BaseModel):
    confirm: str = ""


def update_running():
    for p in psutil.process_iter(["name"]):
        if (p.info.get("name") or "") in BUSY:
            return True
    return False


def run_command(action):
    """Ask systemd to start the shutdown. --no-block returns as soon as the job is queued."""
    return subprocess.run([SUDO, "-n", SYSTEMCTL, "--no-block", ACTIONS[action]],
                          capture_output=True, text=True, timeout=20)


def _do(action, user, ip):
    try:
        r = run_command(action)
        ok = r.returncode == 0
        err = (r.stderr or "").strip()[:200]
    except (OSError, subprocess.SubprocessError) as e:
        ok, err = False, str(e)[:200]
    if not ok:
        audit(user, ip, "power_failed", action=action, error=err)


@router.post("/{action}")
def power(action: str, body: PowerBody, request: Request, tasks: BackgroundTasks,
          user: str = Depends(current_user)):
    ip = request.client.host
    if action not in ACTIONS:
        raise HTTPException(404, "Unknown action")
    host = socket.gethostname()
    if body.confirm.strip() != host:
        raise HTTPException(400, f"Type the machine's name ({host}) to confirm")
    if update_running():
        audit(user, ip, "power_refused", action=action, reason="update running")
        raise HTTPException(409, "A software update is running. Wait until it has finished.")
    audit(user, ip, "power_action", action=action, host=host)
    tasks.add_task(_do, action, user, ip)
    return {"ok": True, "message": "The machine is " + ("rebooting" if action == "reboot" else "shutting down") + " now."}
