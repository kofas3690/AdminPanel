import hmac, json, os, re, secrets, threading, time
from pathlib import Path
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from audit import audit
from store import PersistentDict

router = APIRouter(prefix="/api")
ph = PasswordHasher()
from paths import USERS_FILE
users_lock = threading.Lock()
totp_lock = threading.Lock()

SESSION_TTL = 8 * 3600        # sessions last 8 hours
MAX_FAILS, WINDOW = 5, 300    # 5 failures per 5 minutes, then locked
TOUCH_EVERY = 60              # how often "last active" is refreshed
COOKIE_SECURE = os.environ.get("COOKIE_SECURE") == "1"
ACCOUNT_MAX_FAILS = 20        # wrong attempts per account from ALL addresses together, per 5 minutes
# Emergency switch only: set ADMINPANEL_ALLOW_NO_2FA=1 in the service to let accounts without 2FA in.
REQUIRE_2FA = os.environ.get("ADMINPANEL_ALLOW_NO_2FA") != "1"
RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"   # no look-alike characters
RECOVERY_RE = re.compile(r"[a-z0-9]{10}")

# session value: [username, expires, created, ip, user agent, last active]
sessions = PersistentDict("sessions", hash_keys=True, expires_at=lambda v: v[1])
failures = PersistentDict("failures", expires_at=lambda v: v[1] + WINDOW)
last_counter = PersistentDict("totp_used")
DUMMY_HASH = ph.hash("dummy-password-for-timing")


class LoginBody(BaseModel):
    username: str
    password: str
    code: str = ""


def load_users():
    try:
        return json.loads(USERS_FILE.read_text())
    except (OSError, ValueError):
        return {}


def save_users(users):
    tmp = USERS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(users, indent=2))
    os.chmod(tmp, 0o600)
    os.replace(tmp, USERS_FILE)


def locked(key, limit=MAX_FAILS):
    rec = failures.get(key)
    if not rec:
        return False
    count, first = rec
    if time.time() - first > WINDOW:
        del failures[key]
        return False
    return count >= limit


def record_failure(key):
    count, first = failures.get(key, (0, time.time()))
    failures[key] = (count + 1, first)


def check_totp(username, secret, code):
    if not (code.isascii() and code.isdigit()):
        return False
    totp = pyotp.TOTP(secret)
    now = int(time.time())
    with totp_lock:
        for offset in (-1, 0, 1):
            counter = now // 30 + offset
            if hmac.compare_digest(totp.at(now, offset), code):
                if counter <= last_counter.get(username, -1):
                    return False          # this code was already used
                last_counter[username] = counter
                return True
    return False


# ---------------- recovery codes ----------------

def norm_recovery(code):
    c = re.sub(r"[\s-]", "", code.lower())
    if RECOVERY_RE.fullmatch(c) and all(ch in RECOVERY_ALPHABET for ch in c):
        return c
    return None


def new_recovery_codes(n=10):
    return ["".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(10)) for _ in range(n)]


def pretty(code):
    return code[:5] + "-" + code[5:]


def use_recovery(username, code):
    """Accept a recovery code once, then delete its hash."""
    c = norm_recovery(code)
    if c is None:
        return False
    with users_lock:
        users = load_users()
        rec = users.get(username)
        if not isinstance(rec, dict):
            return False
        for h in list(rec.get("recovery", [])):
            try:
                ph.verify(h, c)
            except Exception:
                continue
            rec["recovery"].remove(h)
            save_users(users)
            return True
    return False


# ---------------- sign in and out ----------------

@router.post("/login")
def login(body: LoginBody, request: Request, response: Response):
    ip = request.client.host
    key = f"{ip}:{body.username}"
    akey = f"account:{body.username[:64]}"
    if locked(key) or locked(akey, ACCOUNT_MAX_FAILS):
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

    if ok and not rec.get("totp") and REQUIRE_2FA:
        # The password was right, so this is not a failed guess; say what to do instead.
        audit(body.username[:64], ip, "login_refused_no_2fa")
        raise HTTPException(403, "Two-step verification is not set up for this account. "
                                 "On the server run: sudo adminpanel-setup 2fa")

    used_recovery = False
    if ok and rec.get("totp"):
        code = body.code.strip()
        digits = code.replace(" ", "")
        if len(digits) == 6 and digits.isdigit():
            ok = check_totp(body.username, rec["totp"], digits)
        else:
            ok = use_recovery(body.username, code)
            used_recovery = ok

    if not ok:
        record_failure(key)
        record_failure(akey)
        audit(body.username[:64], ip, "login_failed")
        raise HTTPException(401, "Invalid username, password or code")

    failures.pop(key, None)       # the account-wide count is left to expire on its own
    token = secrets.token_urlsafe(32)
    now = time.time()
    sessions[token] = [body.username, now + SESSION_TTL, now, ip,
                       request.headers.get("user-agent", "")[:200], now]
    audit(body.username, ip, "login_ok", recovery=used_recovery)
    if used_recovery:
        audit(body.username, ip, "recovery_used")
    response.set_cookie(
        "session", token,
        httponly=True, samesite="strict",
        secure=COOKIE_SECURE, max_age=SESSION_TTL,
    )
    return {"ok": True}


def current_user(request: Request):
    token = request.cookies.get("session")
    rec = sessions.get(token) if token else None
    now = time.time()
    if not rec or rec[1] < now:
        if token:
            sessions.pop(token, None)
        raise HTTPException(401, "Not logged in")
    if len(rec) >= 6 and now - rec[5] > TOUCH_EVERY:
        sessions[token] = [rec[0], rec[1], rec[2], rec[3], rec[4], now]
    return rec[0]


@router.post("/logout")
def logout(request: Request, response: Response, user: str = Depends(current_user)):
    sessions.pop(request.cookies.get("session"), None)
    audit(user, request.client.host, "logout")
    response.delete_cookie("session")
    return {"ok": True}


@router.get("/me")
def me(user: str = Depends(current_user)):
    return {"user": user}
