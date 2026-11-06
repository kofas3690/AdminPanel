from fastapi import APIRouter, Depends, HTTPException, Request
from auth import current_user
from audit import audit
import actions
import remote

router = APIRouter(prefix="/api/services")

# Kept for the code and tests that still import them from here.
ALLOWED = actions.ALLOWED


@router.get("")
def list_services(host: str = "local", user: str = Depends(current_user)):
    if host == "local":
        return actions.list_services()
    try:
        return remote.call(host, "services.list")
    except remote.RemoteError as e:
        raise HTTPException(e.status, e.message)


@router.post("/{name}/{action}")
def act(name: str, action: str, request: Request, host: str = "local",
        user: str = Depends(current_user)):
    where = {} if host == "local" else {"host": host}
    try:
        if host == "local":
            actions.act_service(name, action)
        else:
            remote.call(host, "services.act", {"name": name, "action": action})
    except (actions.ActionError, remote.RemoteError) as e:
        if e.status == 403:
            audit(user, request.client.host, "service_denied", service=name, action=action, **where)
        else:
            audit(user, request.client.host, "service_action", service=name, action=action, ok=False, **where)
        raise HTTPException(e.status, e.message)
    audit(user, request.client.host, "service_action", service=name, action=action, ok=True, **where)
    return {"ok": True}
