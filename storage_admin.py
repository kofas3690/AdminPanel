import json, subprocess, time
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from argon2.exceptions import VerifyMismatchError
import auth
from auth import current_user, load_users, users_lock, ph, check_totp
from audit import audit
from store import PersistentDict

router = APIRouter(prefix="/api/disks")

SUDO = "/usr/bin/sudo"
HELPER = "/usr/local/sbin/adminpanel-disk"
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL": "C"}
UNLOCK_SECONDS = 600

# session token -> [time the unlock ends]
unlocked = PersistentDict("disk_unlock", hash_keys=True, expires_at=lambda v: v[0])


def call(cmd, payload=None, timeout=120):
    kw = {"input": json.dumps(payload)} if payload is not None else {"stdin": subprocess.DEVNULL}
    try:
        return subprocess.run([SUDO, "-n", HELPER, cmd], capture_output=True, text=True,
                              timeout=timeout, env=ENV, **kw)
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "The disk helper took too long to answer. Check the device state before retrying.")


def must(r):
    if r.returncode != 0:
        raise HTTPException(400, (r.stderr or r.stdout).strip()[:4000] or "Command failed")
    return r


@router.get("/inventory")
def inventory(user: str = Depends(current_user)):
    return json.loads(must(call("inventory")).stdout)


class OpBody(BaseModel):
    op: str = Field(pattern=r"^[a-z][a-z-]{1,30}$")
    args: dict = Field(default_factory=dict)


@router.post("/plan")
def plan(body: OpBody, user: str = Depends(current_user)):
    return json.loads(must(call("plan", body.model_dump())).stdout)


# ---------------- unlocking ----------------

@router.get("/unlock")
def unlock_status(request: Request, user: str = Depends(current_user)):
    rec = unlocked.get(request.cookies.get("session"))
    left = int(rec[0] - time.time()) if rec else 0
    return {"unlocked": left > 0, "seconds_left": max(0, left)}


class UnlockBody(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    code: str = Field(default="", max_length=8)


@router.post("/unlock")
def unlock(body: UnlockBody, request: Request, user: str = Depends(current_user)):
    ip = request.client.host
    key = f"diskunlock:{ip}:{user}"
    if auth.locked(key):
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    with users_lock:
        rec = load_users().get(user)
        if isinstance(rec, str):
            rec = {"hash": rec}
        good = False
        if isinstance(rec, dict) and rec.get("hash"):
            try:
                ph.verify(rec["hash"], body.password)
                good = True
            except VerifyMismatchError:
                good = False
            if good and rec.get("totp"):
                good = check_totp(user, rec["totp"], body.code.replace(" ", ""))
    if not good:
        auth.record_failure(key)
        audit(user, ip, "disk_unlock", ok=False)
        raise HTTPException(401, "Wrong password or code. If you just signed in, wait for the next code.")
    auth.failures.pop(key, None)
    unlocked[request.cookies.get("session")] = [time.time() + UNLOCK_SECONDS]
    audit(user, ip, "disk_unlock", ok=True)
    return {"ok": True, "seconds_left": UNLOCK_SECONDS}


@router.post("/lock")
def lock(request: Request, user: str = Depends(current_user)):
    unlocked.pop(request.cookies.get("session"), None)
    return {"ok": True}


@router.post("/apply")
def apply(body: OpBody, request: Request, user: str = Depends(current_user)):
    rec = unlocked.get(request.cookies.get("session"))
    if not rec or rec[0] < time.time():
        raise HTTPException(423, "Disk changes are locked. Unlock them first.")
    r = call("apply", body.model_dump(), timeout=1000)
    audit(user, request.client.host, "disk_apply", op=body.op,
          args=json.dumps(redact(body.args))[:400], ok=(r.returncode == 0))
    must(r)
    return json.loads(r.stdout)


# ---------------- secrets and iSCSI discovery ----------------

SECRET_FRAGMENTS = ("pass", "secret")


def redact(v):
    if isinstance(v, dict):
        return {k: ("***" if any(f in k.lower() for f in SECRET_FRAGMENTS) else redact(x))
                for k, x in v.items()}
    if isinstance(v, list):
        return [redact(x) for x in v]
    return v


class DiscoverBody(BaseModel):
    portal: str = Field(min_length=1, max_length=300)
    iface: str = Field(default="default", pattern=r"^(default|iser)$")
    auth: dict[str, str] | None = None


@router.post("/iscsi/discover")
def iscsi_discover(body: DiscoverBody, request: Request, user: str = Depends(current_user)):
    r = call("iscsi-discover", body.model_dump(), timeout=60)
    audit(user, request.client.host, "iscsi_discover", portal=body.portal, ok=(r.returncode == 0))
    must(r)
    return json.loads(r.stdout)


# ---------------- background jobs and LUKS header backup ----------------

import base64
from fastapi import Response


def require_unlocked(request):
    rec = unlocked.get(request.cookies.get("session"))
    if not rec or rec[0] < time.time():
        raise HTTPException(423, "Disk changes are locked. Unlock them first.")


@router.get("/jobs")
def jobs(user: str = Depends(current_user)):
    return json.loads(must(call("jobs")).stdout)


class JobBody(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{12}$")


@router.post("/jobs/cancel")
def jobs_cancel(body: JobBody, request: Request, user: str = Depends(current_user)):
    require_unlocked(request)
    r = call("job-cancel", body.model_dump())
    audit(user, request.client.host, "disk_job_cancel", id=body.id, ok=(r.returncode == 0))
    must(r)
    return {"ok": True}


class HeaderBody(BaseModel):
    device: str = Field(pattern=r"^/dev/[A-Za-z0-9/_.-]{1,60}$")


@router.post("/luks/header")
def luks_header(body: HeaderBody, request: Request, user: str = Depends(current_user)):
    require_unlocked(request)
    r = call("luks-header", body.model_dump(), timeout=120)
    audit(user, request.client.host, "luks_header_backup", device=body.device, ok=(r.returncode == 0))
    d = json.loads(must(r).stdout)
    return Response(base64.b64decode(d["gz_b64"]), media_type="application/gzip",
                    headers={"Content-Disposition": f'attachment; filename="{d["name"]}"',
                             "Cache-Control": "no-store"})
