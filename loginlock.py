"""Failed-sign-in counters shared by the File manager and the Terminal.

Both pages sign in to Linux accounts over SSH, so both draw on the same budgets, kept in
SQLite so a restart does not reset them:
  * per (client address, panel user): 5 failures in 5 minutes
  * per target Linux account, from any address: 10 failures in 5 minutes
The namespace is the one fs.py always used, so counters carry over when you upgrade.

Two ways to count:
  * record_failure(): add a failure after the fact (the Terminal does this, because it can only
    learn about a failure by reading what ssh prints).
  * reserve() / refund(): the File manager adds the failure BEFORE it tries the password, so a
    burst of simultaneous attempts cannot all pass the check; a successful or never-made attempt
    gives its reservation back. A success never wipes failures that came before it.
"""
import threading, time
from store import PersistentDict

MAX_FAILS, WINDOW = 5, 300
ACCOUNT_MAX_FAILS = 10      # per target Linux account, from any address
fails = PersistentDict("fs_fail", expires_at=lambda v: v[1] + WINDOW)
_lock = threading.Lock()    # the File manager runs in threads, the Terminal in the event loop


def key(ip, panel_user):
    return f"{ip}:{panel_user}"


def account_key(linux_user):
    return f"account:{linux_user}"


def _locked(k, limit):
    rec = fails.get(k)
    return bool(rec and time.time() - rec[1] <= WINDOW and rec[0] >= limit)


def _add(k, n):
    count, first = fails.get(k, (0, time.time()))
    if time.time() - first > WINDOW:
        count, first = 0, time.time()
    count += n
    if count <= 0:
        fails.pop(k, None)
    else:
        fails[k] = (count, first)


def locked(k, limit=MAX_FAILS):
    with _lock:
        return _locked(k, limit)


def record_failure(k, n=1):
    with _lock:
        _add(k, n)


def reserve(budgets):
    """budgets: [(key, limit), ...]. If none is used up, count one attempt against each and
    return True; otherwise count nothing and return False. Check and count are one step."""
    with _lock:
        if any(_locked(k, limit) for k, limit in budgets):
            return False
        for k, _ in budgets:
            _add(k, 1)
        return True


def refund(budgets):
    """Give back the reservation of an attempt that succeeded or never reached a password check."""
    with _lock:
        for k, _ in budgets:
            _add(k, -1)


def clear(k):
    with _lock:
        fails.pop(k, None)


# ---- short wait after a few wrong passwords in a row (File manager sign-in form) ----
# This is only about how the form behaves: after TRIES wrong passwords in a row the form makes you
# wait WAIT seconds. The long-term limits above (5 per address and 10 per account in 5 minutes) still
# apply on top of it, so a success here never gives anyone more guesses than those limits allow.
TRIES, WAIT = 3, 30
_streak = {}                # key -> [wrong in a row, wait until (unix time), last change]
_streak_lock = threading.Lock()


def wait_left(k):
    """Whole seconds still to wait before this key may try again (0 = may try now)."""
    with _streak_lock:
        rec = _streak.get(k)
        if not rec or rec[1] <= 0:
            return 0
        left = rec[1] - time.time()
        if left <= 0:
            _streak.pop(k, None)            # the wait is over: three fresh tries
            return 0
        return int(left) + (left > int(left))


def note_wrong(k):
    """Counts one wrong password. Returns (tries left, seconds to wait); the wait starts after the third."""
    now = time.time()
    with _streak_lock:
        for old in [x for x, r in _streak.items() if now - r[2] > WINDOW]:
            del _streak[old]                # forget old entries so the table cannot grow
        rec = _streak.setdefault(k, [0, 0.0, now])
        if rec[1] and now >= rec[1]:
            rec[0], rec[1] = 0, 0.0
        rec[0] += 1
        rec[2] = now
        if rec[0] >= TRIES:
            rec[1] = now + WAIT
            return 0, WAIT
        return TRIES - rec[0], 0


def note_right(k):
    with _streak_lock:
        _streak.pop(k, None)
