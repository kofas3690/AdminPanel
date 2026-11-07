import asyncio, fcntl, json, os, pty, pwd, re, shutil, struct, tempfile, termios, time
from pathlib import Path
from fastapi import APIRouter, WebSocket
import loginlock
from audit import audit
from logs import ws_user, origin_ok
from sshkeys import normalize_key

router = APIRouter()

from paths import DATA

SSH = "/usr/bin/ssh"
SETSID = "/usr/bin/setsid"
KNOWN_HOSTS = Path("/var/lib/adminpanel/ssh_known_hosts")   # root-owned: the panel can read it, not change it
ENV = {"PATH": "/usr/bin:/bin", "TERM": "xterm-256color",
       "HOME": str(DATA), "LANG": "C.UTF-8"}
NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_.-]{0,31}")
MAX_TOTAL, MAX_PER_USER = 3, 2
IDLE_LIMIT = 15 * 60
KEY_WAIT = 30
OPEN_LIMIT, OPEN_WINDOW = 10, 300   # at most 10 terminals per panel user per 5 minutes
recent_opens = {}                  # panel user -> times of recent opens
AUTH_PHASE = 120                   # only the first two minutes of a session can count as sign-in failures
# ssh's own failure messages. A remote command's "Permission denied" looks different
# ("ls: cannot open directory ...: Permission denied"), so it does not match.
FAIL_RE = re.compile(rb"Permission denied(?:, please try again| \()")
LOCKED_MSG = b"\r\n[Too many failed sign-ins. Try again in a few minutes.]\r\n"

active = {}   # panel user -> number of open terminals


def is_root(name):
    try:
        return name == "root" or pwd.getpwnam(name).pw_uid == 0
    except KeyError:
        return False


def too_many_opens(user):
    now = time.time()
    times = [t for t in recent_opens.get(user, []) if now - t < OPEN_WINDOW]
    if len(times) >= OPEN_LIMIT:
        recent_opens[user] = times
        return True
    times.append(now)
    recent_opens[user] = times
    return False


class FailureWatch:
    """Counts ssh's failed-sign-in messages in the terminal output stream.

    Keystrokes (including the password) pass through the panel on their way to ssh, but the
    panel never inspects or logs them; the only way to learn that a sign-in failed is to read
    what ssh prints."""

    def __init__(self, started):
        self.started = started
        self.total = 0           # failures seen in this session
        self.tail = b""          # end of the previous chunk, in case a message is split in two

    def feed(self, data, now):
        if now - self.started > AUTH_PHASE:
            return 0
        buf = self.tail + data
        hits = list(FAIL_RE.finditer(buf))
        rest = buf[hits[-1].end():] if hits else buf
        self.tail = rest[-40:]
        self.total += len(hits)
        return len(hits)


def clamp(n):
    return max(1, min(int(n), 500))


def set_size(fd, rows, cols):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


async def write_all(fd, data):
    view = memoryview(data)
    while len(view):
        try:
            n = os.write(fd, view)
            view = view[n:]
        except BlockingIOError:
            await asyncio.sleep(0.01)


def ssh_args(u, keyfile=None):
    args = ["-tt", "-e", "none", "-F", "/dev/null",
            "-o", "StrictHostKeyChecking=yes",
            "-o", f"UserKnownHostsFile={KNOWN_HOSTS}",
            "-o", "GlobalKnownHostsFile=/dev/null",
            "-o", "HostKeyAlgorithms=ssh-ed25519"]
    if keyfile is None:
        args += ["-o", "PubkeyAuthentication=no",
                 "-o", "PreferredAuthentications=password,keyboard-interactive"]
    else:
        args += ["-o", "PubkeyAuthentication=yes",
                 "-o", "PreferredAuthentications=publickey",
                 "-o", "IdentitiesOnly=yes",
                 "-o", f"IdentityFile={keyfile}"]
    args += ["-o", "ConnectTimeout=10",
             "-o", "NumberOfPasswordPrompts=3",
             "-o", "ServerAliveInterval=30",
             "-o", "ClearAllForwardings=yes",
             "-o", "ForwardAgent=no", "-o", "ForwardX11=no",
             "-l", u, "127.0.0.1"]
    return args


KEY_LIFETIME = 30         # seconds the key file may exist; ssh reads it within a moment of starting


def key_dir_base():
    """RAM-backed folder if there is one, so the key is never written to a disk."""
    shm = "/dev/shm"
    return shm if os.path.isdir(shm) and os.access(shm, os.W_OK | os.X_OK) else None


def drop_key(keyfile):
    """Removes the key file and its private folder (safe to call twice)."""
    if keyfile is not None:
        shutil.rmtree(os.path.dirname(keyfile), ignore_errors=True)


async def read_key(ws):
    """Waits for the browser's first message, which carries the private key, and
    puts it in a file that only the panel can read (0600, in its own 0700 folder in
    RAM). ssh cannot be handed an open file: it closes every file it did not open
    itself when it starts. The file is deleted a few seconds later, or when the
    session ends, whichever comes first."""
    msg = await asyncio.wait_for(ws.receive(), KEY_WAIT)
    if msg.get("type") != "websocket.receive" or msg.get("text") is None:
        raise ValueError("the key was not received")
    try:
        data = json.loads(msg["text"])
    except ValueError:
        raise ValueError("the key message was not understood")
    if not isinstance(data, dict) or data.get("type") != "key":
        raise ValueError("the key message was not understood")
    text = normalize_key(data.get("key"))
    folder = tempfile.mkdtemp(prefix="apkey-", dir=key_dir_base())      # mode 0700
    path = os.path.join(folder, "id")
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.write(fd, text.encode("ascii"))
        finally:
            os.close(fd)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise
    return path


@router.websocket("/api/terminal/ws")
async def terminal(ws: WebSocket, u: str = "", cols: int = 80, rows: int = 24, auth: str = "password"):
    user = ws_user(ws)
    if (user is None or not origin_ok(ws) or not NAME.fullmatch(u)
            or auth not in ("password", "key") or not KNOWN_HOSTS.exists()):
        await ws.close(code=1008)
        return
    if is_root(u):
        await ws.close(code=1008)
        return
    if too_many_opens(user):
        await ws.close(code=1013)
        return
    if sum(active.values()) >= MAX_TOTAL or active.get(user, 0) >= MAX_PER_USER:
        await ws.close(code=1013)
        return
    # Reserve the session slot before the first await, so several simultaneous connections
    # cannot all pass the limit check above.
    active[user] = active.get(user, 0) + 1

    def release():
        active[user] -= 1
        if active[user] <= 0:
            del active[user]

    lock_key = loginlock.key(ws.client.host, user)
    acct_key = loginlock.account_key(u)

    def is_locked():
        return (loginlock.locked(lock_key)
                or loginlock.locked(acct_key, loginlock.ACCOUNT_MAX_FAILS))

    try:
        await ws.accept()
    except Exception:
        release()
        return
    if is_locked():
        try:
            await ws.send_bytes(LOCKED_MSG)
            await ws.close()
        except Exception:
            pass
        release()
        return

    started = last_input = time.time()
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()
    master = slave = -1
    keyfile = None
    reading = False
    proc = None
    tasks = []
    watch = FailureWatch(started)

    def on_readable():
        try:
            data = os.read(master, 65536)
        except BlockingIOError:
            return
        except OSError:               # EIO: the program closed the terminal
            data = b""
        failed = watch.feed(data, time.time()) if data else 0
        if failed:
            loginlock.record_failure(lock_key, failed)
            loginlock.record_failure(acct_key, failed)
            audit(user, ws.client.host, "terminal_auth_failed", target=u, count=failed)
        queue.put_nowait(data)
        if failed and is_locked():                     # stop further guesses right now
            queue.put_nowait(LOCKED_MSG)
            queue.put_nowait(b"")
            stop_reading()
            return
        if not data or queue.qsize() > 64:
            stop_reading()

    def start_reading():
        nonlocal reading
        if not reading:
            loop.add_reader(master, on_readable)
            reading = True

    def stop_reading():
        nonlocal reading
        if reading:
            loop.remove_reader(master)
            reading = False

    async def pump_out():
        while True:
            data = await queue.get()
            if not data:
                return
            await ws.send_bytes(data)
            if queue.qsize() < 16:
                start_reading()

    async def pump_in():
        nonlocal last_input
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                return
            if msg.get("bytes") is not None:
                last_input = time.time()
                await write_all(master, msg["bytes"])
            elif msg.get("text") is not None:
                try:
                    c = json.loads(msg["text"])
                    if c.get("type") == "resize":
                        set_size(master, clamp(c["rows"]), clamp(c["cols"]))
                except Exception:        # a malformed control message is ignored, never fatal
                    pass

    async def watchdog():
        while True:
            await asyncio.sleep(15)
            if ws_user(ws) is None:                      # logged out or expired
                return
            if time.time() - last_input > IDLE_LIMIT:    # nobody typing
                return

    try:
        if auth == "key":
            try:
                keyfile = await read_key(ws)
            except (ValueError, asyncio.TimeoutError) as e:
                msg = str(e) or "no key was received in time"
                try:
                    await ws.send_bytes(f"\r\n[{msg}]\r\n".encode())
                except Exception:
                    pass
                return
        master, slave = pty.openpty()
        os.set_blocking(master, False)
        set_size(master, clamp(rows), clamp(cols))
        proc = await asyncio.create_subprocess_exec(
            SETSID, "--ctty", SSH, *ssh_args(u, keyfile),
            stdin=slave, stdout=slave, stderr=slave, env=ENV,
        )
        os.close(slave)
        slave = -1
        if keyfile is not None:  # ssh reads the key as it starts; do not leave it lying around
            loop.call_later(KEY_LIFETIME, drop_key, keyfile)
        audit(user, ws.client.host, "terminal_open", target=u, method=auth)
        start_reading()
        tasks = [asyncio.create_task(c()) for c in (pump_out, pump_in, watchdog)]
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        stop_reading()
        if proc is not None and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), 5)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
            except ProcessLookupError:
                pass
        for fd in (master, slave):
            if fd != -1:
                os.close(fd)
        drop_key(keyfile)
        release()
        if proc is not None:
            audit(user, ws.client.host, "terminal_close", target=u,
                  seconds=int(time.time() - started), auth_failures=watch.total)
        try:
            await ws.close()
        except Exception:
            pass
