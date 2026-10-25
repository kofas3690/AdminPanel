import hmac
import pyotp
import json, os, secrets, time
from pathlib import Path
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter(prefix="/api")
ph = PasswordHasher()
USERS_FILE = Path(__file__).parent / "users.json"

SESSION_TTL = 8 * 3600        # sessions last 8 hours
MAX_FAILS, WINDOW = 5, 300    # 5 failures per 5 minutes, then locked
COOKIE_SECURE = os.environ.get("COOKIE_SECURE") == "1"

sessions = {}   # token -> (username, expiry timestamp)
failures = {}   # "ip:username" -> (fail count, time of first fail)
last_counter = {}   # username -> last accepted 30-second time step
DUMMY_HASH = ph.hash("dummy-password-for-timing")


class LoginBody(BaseModel):
    username: str
    password: str
    code: str = ""

def load_users():
    return json.loads(USERS_FILE.read_text()) if USERS_FILE.exists() else {}


def locked(key):
    rec = failures.get(key)
    if not rec:
        return False
    count, first = rec
    if time.time() - first > WINDOW:
        del failures[key]
        return False
    return count >= MAX_FAILS


def record_failure(key):
    count, first = failures.get(key, (0, time.time()))
    failures[key] = (count + 1, first)

def check_totp(username, secret, code):
    totp = pyotp.TOTP(secret)
    now = int(time.time())
    for offset in (-1, 0, 1):
        counter = now // 30 + offset
        if hmac.compare_digest(totp.at(now, offset), code):
            if counter <= last_counter.get(username, -1):
                return False          # this code was already used
            last_counter[username] = counter
            return True
    return False

@router.post("/login")
def login(body: LoginBody, request: Request, response: Response):
    key = f"{request.client.host}:{body.username}"
    if locked(key):
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")

    users = load_users()
    rec = users.get(body.username)
    if isinstance(rec, str):
       	rec = {"hash": rec}
    stored = rec["hash"] if rec else DUMMY_HASH
    try:
       	ph.verify(stored, body.password)
       	ok = rec is not None
    except VerifyMismatchError:
       	ok = False

    if ok and rec.get("totp"):
       	ok = check_totp(body.username, rec["totp"], body.code.replace(" ", ""))

    if not ok:
        record_failure(key)
        raise HTTPException(401, "Invalid username, password or code")

    failures.pop(key, None)
    token = secrets.token_urlsafe(32)
    sessions[token] = (body.username, time.time() + SESSION_TTL)
    response.set_cookie(
        "session", token,
        httponly=True, samesite="strict",
        secure=COOKIE_SECURE, max_age=SESSION_TTL,
    )
    return {"ok": True}


def current_user(request: Request):
    token = request.cookies.get("session")
    rec = sessions.get(token) if token else None
    if not rec or rec[1] < time.time():
        sessions.pop(token, None)
        raise HTTPException(401, "Not logged in")
    return rec[0]


@router.post("/logout")
def logout(request: Request, response: Response, user: str = Depends(current_user)):
    sessions.pop(request.cookies.get("session"), None)
    response.delete_cookie("session")
    return {"ok": True}


@router.get("/me")
def me(user: str = Depends(current_user)):
    return {"user": user}
