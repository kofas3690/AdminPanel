"""Reboot and shut down this machine from the Overview page.

Two things make it hard to do by accident: the caller must type the machine's own name, and nothing
happens while a software update (apt or dpkg) is running, because stopping one half way can leave
packages broken. The attempt is written to the audit log first, and the command runs only after the
answer has been sent, since the panel stops with the machine.
"""
import socket
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import current_user
from audit import audit
import actions

router = APIRouter(prefix="/api/power")

ACTIONS = actions.POWER_ACTIONS
update_running = actions.update_running            # the same checks and command as on other machines


class PowerBody(BaseModel):
    confirm: str = ""


def run_command(action):
    return actions.run_power(action)


def _do(action, user, ip):
    try:
        run_command(action)
    except (actions.ActionError, OSError) as e:
        audit(user, ip, "power_failed", action=action, error=str(getattr(e, "message", e))[:200])


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
