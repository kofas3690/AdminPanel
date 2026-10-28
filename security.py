import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from argon2.exceptions import VerifyMismatchError
import auth
from audit import AUDIT, audit
from auth import (current_user, sessions, load_users, save_users, users_lock, ph,
                  check_totp, new_recovery_codes, pretty)

router = APIRouter(prefix="/api/security")

EVENTS = {"login_ok", "login_failed", "logout", "recovery_used",
          "recovery_generated", "session_revoked"}


def recent_activity(limit=30):
    try:
        size = AUDIT.stat().st_size
        with AUDIT.open("rb") as f:
            f.seek(max(0, size - 400_000))
            data = f.read().decode("utf-8", "replace")
    except OSError:
        return []
    out = []
    for line in reversed(data.splitlines()):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("event") in EVENTS:
            out.append({k: e.get(k) for k in ("ts", "user", "ip", "event")})
            if len(out) >= limit:
                break
    return out


@router.get("/status")
def status(request: Request, user: str = Depends(current_user)):
    mine = sessions.stored_key(request.cookies.get("session"))
    rows = []
    for k, v in sessions.items():
        rows.append({
            "id": k[:16], "user": v[0], "expires": v[1],
            "created": v[2] if len(v) > 2 else None,
            "ip": v[3] if len(v) > 3 else "",
            "ua": v[4] if len(v) > 4 else "",
            "last_seen": v[5] if len(v) > 5 else None,
            "current": k == mine,
        })
    rows.sort(key=lambda r: (not r["current"], -(r["last_seen"] or r["created"] or 0)))
    rec = load_users().get(user)
    rec = rec if isinstance(rec, dict) else {}
    return {"user": user, "totp": bool(rec.get("totp")),
            "recovery_left": len(rec.get("recovery", [])),
            "sessions": rows, "activity": recent_activity()}


class RevokeBody(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{16}$")


@router.post("/sessions/revoke")
def revoke(body: RevokeBody, request: Request, user: str = Depends(current_user)):
    mine = sessions.stored_key(request.cookies.get("session"))
    hits = [k for k, _ in sessions.items() if k.startswith(body.id)]
    if len(hits) != 1:
        raise HTTPException(404, "No such session")
    if hits[0] == mine:
        raise HTTPException(400, "That is your current session. Use Log out instead.")
    sessions.delete_raw(hits[0])
    audit(user, request.client.host, "session_revoked", id=body.id)
    return {"ok": True}


@router.post("/sessions/revoke-others")
def revoke_others(request: Request, user: str = Depends(current_user)):
    mine = sessions.stored_key(request.cookies.get("session"))
    n = 0
    for k, _ in sessions.items():
        if k != mine:
            sessions.delete_raw(k)
            n += 1
    audit(user, request.client.host, "session_revoked", count=n)
    return {"ok": True, "count": n}


class RecoveryBody(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    code: str = Field(min_length=6, max_length=8)


@router.post("/recovery")
def generate(body: RecoveryBody, request: Request, user: str = Depends(current_user)):
    ip = request.client.host
    key = f"stepup:{ip}:{user}"
    if auth.locked(key):
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    with users_lock:
        users = load_users()
        rec = users.get(user)
        if isinstance(rec, str):
            rec = {"hash": rec}
        if not isinstance(rec, dict) or not rec.get("totp"):
            raise HTTPException(400, "Two-step verification isn't enabled for this account. Run enroll_2fa.py first.")
        try:
            ph.verify(rec["hash"], body.password)
            good = True
        except VerifyMismatchError:
            good = False
        if good:
            good = check_totp(user, rec["totp"], body.code.replace(" ", ""))
        if not good:
            auth.record_failure(key)
            audit(user, ip, "recovery_generate_failed")
            raise HTTPException(401, "Wrong password or code")
        codes = new_recovery_codes()
        rec["recovery"] = [ph.hash(c) for c in codes]
        users[user] = rec
        save_users(users)
    auth.failures.pop(key, None)
    audit(user, ip, "recovery_generated", count=len(codes))
    return {"codes": [pretty(c) for c in codes]}
