import asyncio, errno, grp, os, posixpath, pwd, re, secrets, shlex, stat, threading, time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import quote

import paramiko
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from audit import audit
from auth import current_user, sessions
from store import PersistentDict

router = APIRouter(prefix="/api/fs")

KNOWN_HOSTS = Path(__file__).parent / "ssh_known_hosts"
USER_RE = re.compile(r"[a-z_][a-z0-9_-]{0,31}")
IDLE = 15 * 60
MAX_PER_SESSION, MAX_TOTAL = 3, 8
MAX_UPLOAD = 500 * 1024 * 1024
MAX_EDIT = 256 * 1024
MAX_LIST = 5000
MAX_LINKS = 300
MAX_FAILS, WINDOW = 5, 300
ENV = {"PATH": "/usr/bin:/bin", "LC_ALL": "C"}

fails = PersistentDict("fs_fail", expires_at=lambda v: v[1] + WINDOW)
pool = {}                      # (panel session token, linux user) -> Conn
plock = threading.Lock()


class Conn:
    def __init__(self, client, user, home, token):
        self.client, self.user, self.home, self.token = client, user, home, token
        self.last = time.time()


def alive(c):
    t = c.client.get_transport()
    return t is not None and t.is_active()


def reaper():
    while True:
        time.sleep(30)
        now = time.time()
        with plock:
            dead = [k for k, c in pool.items()
                    if now - c.last > IDLE or not alive(c) or sessions.get(c.token) is None]
            conns = [pool.pop(k) for k in dead]
        for c in conns:
            try:
                c.client.close()
            except Exception:
                pass


threading.Thread(target=reaper, daemon=True).start()


# ---------------- errors, names and paths ----------------

def fail(e):
    if isinstance(e, HTTPException):
        raise e
    if isinstance(e, (EOFError, ConnectionError, paramiko.SSHException)):
        raise HTTPException(409, "Not connected as that account. Connect again.")
    if isinstance(e, FileNotFoundError):
        raise HTTPException(404, "Not found")
    if isinstance(e, PermissionError):
        raise HTTPException(403, "Permission denied")
    if isinstance(e, FileExistsError):
        raise HTTPException(409, "Already exists")
    if isinstance(e, NotADirectoryError):
        raise HTTPException(400, "That is not a folder")
    if isinstance(e, IsADirectoryError):
        raise HTTPException(400, "That is a folder")
    if isinstance(e, UnicodeError):
        raise HTTPException(400, "A name here is not valid UTF-8")
    if isinstance(e, OSError):
        if e.errno == errno.ENOSPC:
            raise HTTPException(507, "No space left on device")
        raise HTTPException(400, "The operation failed (it may already exist, or a folder may not be empty)")
    raise HTTPException(500, "Unexpected error")


def clean(path):
    if not isinstance(path, str) or not path.startswith("/") or "\x00" in path or len(path) > 4096:
        raise HTTPException(400, "Invalid path")
    try:
        path.encode("utf-8")
    except UnicodeEncodeError:
        raise HTTPException(400, "Invalid path")
    p = posixpath.normpath(path)
    return "/" + p.lstrip("/") if p.startswith("//") else p


def check_name(name):
    try:
        n = len(name.encode("utf-8"))
    except UnicodeEncodeError:
        n = 0
    if not 0 < n <= 255 or name in (".", "..") or "/" in name or "\x00" in name:
        raise HTTPException(400, "Invalid name")
    return name


def conn_dep(request: Request, user: str, panel_user: str = Depends(current_user)):
    if not USER_RE.fullmatch(user):
        raise HTTPException(400, "Invalid account name")
    token = request.cookies.get("session")
    with plock:
        c = pool.get((token, user))
        if c is not None and not alive(c):
            pool.pop((token, user), None)
            c = None
    if c is None:
        raise HTTPException(409, "Not connected as that account. Connect again.")
    c.last = time.time()
    return c


@contextmanager
def sftp_for(c):
    try:
        s = c.client.open_sftp()
    except Exception as e:
        fail(e)
    try:
        yield s
    finally:
        try:
            s.close()
        except Exception:
            pass


def exists(s, p):
    try:
        s.lstat(p)
        return True
    except FileNotFoundError:
        return False


def run(c, argv, timeout=300):
    cmd = " ".join(shlex.quote(a) for a in argv)
    try:
        _, out, err = c.client.exec_command(cmd, timeout=timeout)
        out_t = out.read().decode("utf-8", "replace")[:20000]
        err_t = err.read().decode("utf-8", "replace")[:20000]
        code = out.channel.recv_exit_status()
    except Exception as e:
        fail(e)
    return code, out_t, err_t


def kind_of(mode):
    return ("link" if stat.S_ISLNK(mode) else "dir" if stat.S_ISDIR(mode)
            else "file" if stat.S_ISREG(mode) else "other")


def uname(uid, cache):
    if uid not in cache:
        try:
            cache[uid] = pwd.getpwuid(uid).pw_name
        except KeyError:
            cache[uid] = str(uid)
    return cache[uid]


def gname(gid, cache):
    if gid not in cache:
        try:
            cache[gid] = grp.getgrgid(gid).gr_name
        except KeyError:
            cache[gid] = str(gid)
    return cache[gid]


def version_of(st):
    return f"{int(st.st_mtime or 0)}:{st.st_size or 0}"


def disposition(name):
    ascii_name = name.encode("ascii", "replace").decode().replace('"', "_").replace("\\", "_").replace("?", "_")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"


# ---------------- signing in to an account ----------------

class ConnectBody(BaseModel):
    user: str = Field(pattern=r"^[a-z_][a-z0-9_-]{0,31}$")
    password: str = Field(min_length=1, max_length=256)


@router.post("/connect")
def connect(body: ConnectBody, request: Request, panel_user: str = Depends(current_user)):
    token = request.cookies.get("session")
    ip = request.client.host
    key = f"{ip}:{panel_user}"
    rec = fails.get(key)
    if rec and time.time() - rec[1] <= WINDOW and rec[0] >= MAX_FAILS:
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")
    if not KNOWN_HOSTS.exists():
        raise HTTPException(500, "The SSH host key file is missing (see the Terminal setup)")
    try:
        pw = pwd.getpwnam(body.user)
    except KeyError:
        pw = None
    if body.user == "root" or (pw is not None and pw.pw_uid == 0):
        raise HTTPException(403, "The root account can't be used here")

    with plock:
        have = pool.get((token, body.user))
        if have is not None and alive(have):
            have.last = time.time()
            return {"user": body.user, "home": have.home}
        if sum(1 for k in pool if k[0] == token) >= MAX_PER_SESSION or len(pool) >= MAX_TOTAL:
            raise HTTPException(409, "Too many accounts are connected. Disconnect one first.")

    def rejected(msg):
        count, first = fails.get(key, (0, time.time()))
        fails[key] = (count + 1, first)
        audit(panel_user, ip, "fs_connect", target=body.user, ok=False)
        raise HTTPException(401, msg)

    if pw is None:
        rejected("Wrong user name or password")
    client = paramiko.SSHClient()
    client.load_host_keys(str(KNOWN_HOSTS))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect("127.0.0.1", port=22, username=body.user, password=body.password,
                       look_for_keys=False, allow_agent=False,
                       timeout=10, auth_timeout=20, banner_timeout=20)
    except paramiko.AuthenticationException:
        client.close()
        rejected("Wrong user name or password")
    except paramiko.SSHException as e:
        client.close()
        raise HTTPException(502, f"Could not open a secure connection to the SSH server: {e}"[:200])
    except OSError:
        client.close()
        raise HTTPException(502, "The SSH server isn't reachable on this machine")

    client.get_transport().set_keepalive(30)
    c = Conn(client, body.user, pw.pw_dir, token)
    with plock:
        old = pool.pop((token, body.user), None)
        pool[(token, body.user)] = c
    if old is not None:
        try:
            old.client.close()
        except Exception:
            pass
    fails.pop(key, None)
    audit(panel_user, ip, "fs_connect", target=body.user, ok=True)
    return {"user": body.user, "home": pw.pw_dir}


@router.get("/accounts")
def accounts(request: Request, panel_user: str = Depends(current_user)):
    token = request.cookies.get("session")
    with plock:
        return [{"user": c.user, "home": c.home}
                for (t, _), c in pool.items() if t == token and alive(c)]


@router.post("/disconnect")
def disconnect(request: Request, user: str, panel_user: str = Depends(current_user)):
    token = request.cookies.get("session")
    with plock:
        c = pool.pop((token, user), None)
    if c is not None:
        try:
            c.client.close()
        except Exception:
            pass
    audit(panel_user, request.client.host, "fs_disconnect", target=user)
    return {"ok": True}


# ---------------- browsing ----------------

@router.get("/list")
def list_dir(path: str = "/", dirs_only: bool = False,
             c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(path)
    items, truncated, links = [], False, 0
    uc, gc = {}, {}
    try:
        with sftp_for(c) as s:
            for a in s.listdir_attr(p):
                mode = a.st_mode or 0
                kind = kind_of(mode)
                link_dir, target = False, ""
                if kind == "link" and links < MAX_LINKS:
                    links += 1
                    full = posixpath.join(p, a.filename)
                    try:
                        link_dir = stat.S_ISDIR(s.stat(full).st_mode or 0)
                    except Exception:
                        pass
                    try:
                        target = s.readlink(full) or ""
                    except Exception:
                        pass
                if dirs_only and not (kind == "dir" or link_dir):
                    continue
                if len(items) >= MAX_LIST:
                    truncated = True
                    break
                items.append({
                    "name": a.filename, "type": kind, "link_dir": link_dir, "target": target,
                    "size": a.st_size or 0, "mtime": a.st_mtime or 0,
                    "mode": stat.filemode(mode),
                    "owner": uname(a.st_uid, uc) if a.st_uid is not None else "",
                    "group": gname(a.st_gid, gc) if a.st_gid is not None else "",
                })
    except Exception as e:
        fail(e)
    free = None
    try:
        v = os.statvfs(p)
        free = v.f_bavail * v.f_frsize
    except OSError:
        pass
    return {"path": p, "items": items, "truncated": truncated, "free": free}


@router.get("/info")
def info(path: str, size: bool = False,
         c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(path)
    target, link_dir = "", False
    try:
        with sftp_for(c) as s:
            a = s.lstat(p)
            mode = a.st_mode or 0
            kind = kind_of(mode)
            if kind == "link":
                try:
                    target = s.readlink(p) or ""
                except Exception:
                    pass
                try:
                    link_dir = stat.S_ISDIR(s.stat(p).st_mode or 0)
                except Exception:
                    pass
    except Exception as e:
        fail(e)
    out = {
        "path": p, "name": posixpath.basename(p) or "/", "type": kind, "link_dir": link_dir,
        "target": target, "size": a.st_size or 0, "mtime": a.st_mtime or 0,
        "mode_octal": format(mode & 0o7777, "04o"), "mode": stat.filemode(mode),
        "owner": uname(a.st_uid, {}) if a.st_uid is not None else "",
        "group": gname(a.st_gid, {}) if a.st_gid is not None else "",
    }
    if size and kind == "dir":
        code, text, _ = run(c, ["du", "-sb", "--", p], timeout=60)
        m = re.match(r"(\d+)", text)
        if m:
            out["dir_size"] = int(m.group(1))
    return out


# ---------------- downloading, reading and editing ----------------

@router.get("/download")
def download(path: str, request: Request,
             c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(path)
    s = f = None
    size = 0
    try:
        s = c.client.open_sftp()
        st = s.stat(p)
        if not stat.S_ISREG(st.st_mode or 0):
            raise HTTPException(400, "Not a regular file")
        f = s.open(p, "rb")
        size = st.st_size or 0
    except Exception as e:
        for x in (f, s):
            try:
                if x is not None:
                    x.close()
            except Exception:
                pass
        fail(e)
    audit(panel_user, request.client.host, "fs_download", target=c.user, path=p, bytes=size)

    def gen():
        try:
            if size:
                f.prefetch(size, max_concurrent_requests=32)
            while True:
                chunk = f.read(262144)
                if not chunk:
                    break
                yield chunk
        finally:
            for x in (f, s):
                try:
                    x.close()
                except Exception:
                    pass

    return StreamingResponse(gen(), media_type="application/octet-stream", headers={
        "Content-Disposition": disposition(posixpath.basename(p)),
        "Content-Length": str(size),
        "X-Content-Type-Options": "nosniff",
    })


@router.get("/read")
def read_text(path: str, request: Request,
              c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(path)
    try:
        with sftp_for(c) as s:
            st = s.stat(p)
            if not stat.S_ISREG(st.st_mode or 0):
                raise HTTPException(400, "Not a regular file")
            if (st.st_size or 0) > MAX_EDIT:
                raise HTTPException(413, "File is too large to edit here (limit 256 KB)")
            with s.open(p, "rb") as f:
                data = f.read(MAX_EDIT + 1)
    except Exception as e:
        fail(e)
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, "Not a UTF-8 text file")
    if "\x00" in text:
        raise HTTPException(415, "Not a text file")
    audit(panel_user, request.client.host, "fs_read", target=c.user, path=p)
    return {"text": text, "version": version_of(st)}


class WriteBody(BaseModel):
    path: str
    text: str = Field(max_length=MAX_EDIT)
    version: str


@router.put("/write")
def write_text(body: WriteBody, request: Request,
               c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(body.path)
    try:
        data = body.text.encode("utf-8")
    except UnicodeEncodeError:
        raise HTTPException(400, "Text contains invalid characters")
    if len(data) > MAX_EDIT:
        raise HTTPException(413, "Text is too large (limit 256 KB)")
    try:
        with sftp_for(c) as s:
            st = s.stat(p)
            if not stat.S_ISREG(st.st_mode or 0):
                raise HTTPException(400, "Not a regular file")
            if version_of(st) != body.version:
                raise HTTPException(409, "The file changed since you opened it. Close and reopen it.")
            mode = (st.st_mode or 0o644) & 0o7777
            tmp = posixpath.join(posixpath.dirname(p), f".panel-{secrets.token_hex(4)}.tmp")
            try:
                with s.open(tmp, "wb") as f:
                    f.write(data)
                s.chmod(tmp, mode)
                s.posix_rename(tmp, p)
            except PermissionError:
                try:
                    s.remove(tmp)
                except Exception:
                    pass
                with s.open(p, "wb") as f:      # the folder is read-only; write in place
                    f.write(data)
            except Exception:
                try:
                    s.remove(tmp)
                except Exception:
                    pass
                raise
            st2 = s.stat(p)
    except Exception as e:
        fail(e)
    audit(panel_user, request.client.host, "fs_write", target=c.user, path=p, bytes=len(data))
    return {"ok": True, "version": version_of(st2)}


# ---------------- uploading ----------------

@router.put("/upload")
async def upload(request: Request, path: str, overwrite: bool = False,
                 c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(path)
    if p == "/":
        raise HTTPException(400, "Invalid name")
    check_name(posixpath.basename(p))
    cl = request.headers.get("content-length", "")
    if cl.isdigit() and int(cl) > MAX_UPLOAD:
        raise HTTPException(413, "File is too large (limit 500 MB)")
    tmp = posixpath.join(posixpath.dirname(p), f".upload-{secrets.token_hex(4)}.tmp")
    s = f = None
    total, done = 0, False
    try:
        s = await asyncio.to_thread(c.client.open_sftp)
        try:
            st = await asyncio.to_thread(s.lstat, p)
            if not overwrite:
                raise HTTPException(409, "A file with that name already exists")
            if not stat.S_ISREG(st.st_mode or 0):
                raise HTTPException(400, "Can't replace that")
        except FileNotFoundError:
            pass
        f = await asyncio.to_thread(s.open, tmp, "wb")
        f.set_pipelined(True)
        async for chunk in request.stream():
            total += len(chunk)
            if total > MAX_UPLOAD:
                raise HTTPException(413, "File is too large (limit 500 MB)")
            await asyncio.to_thread(f.write, chunk)
        await asyncio.to_thread(f.close)
        f = None
        await asyncio.to_thread(s.posix_rename, tmp, p)
        done = True
    except Exception as e:
        fail(e)
    finally:
        if f is not None:
            try:
                await asyncio.to_thread(f.close)
            except Exception:
                pass
        if s is not None:
            if not done:
                try:
                    await asyncio.to_thread(s.remove, tmp)
                except Exception:
                    pass
            try:
                await asyncio.to_thread(s.close)
            except Exception:
                pass
    audit(panel_user, request.client.host, "fs_upload", target=c.user, path=p, bytes=total)
    return {"ok": True, "bytes": total}


# ---------------- creating, renaming, moving, copying, deleting ----------------

class PathBody(BaseModel):
    path: str


class RenameBody(PathBody):
    new_name: str


class PathsBody(BaseModel):
    paths: list[str] = Field(min_length=1, max_length=200)


class MoveBody(PathsBody):
    dest: str
    auto_rename: bool = False


class ChmodBody(PathBody):
    mode: str = Field(pattern=r"^[0-7]{3,4}$")


@router.post("/mkdir")
def mkdir(body: PathBody, request: Request,
          c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(body.path)
    check_name(posixpath.basename(p))
    try:
        with sftp_for(c) as s:
            if exists(s, p):
                raise HTTPException(409, "That name already exists")
            s.mkdir(p, 0o755)
    except Exception as e:
        fail(e)
    audit(panel_user, request.client.host, "fs_mkdir", target=c.user, path=p)
    return {"ok": True}


@router.post("/newfile")
def newfile(body: PathBody, request: Request,
            c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(body.path)
    check_name(posixpath.basename(p))
    try:
        with sftp_for(c) as s:
            if exists(s, p):
                raise HTTPException(409, "That name already exists")
            with s.open(p, "wx"):
                pass
    except Exception as e:
        fail(e)
    audit(panel_user, request.client.host, "fs_newfile", target=c.user, path=p)
    return {"ok": True}


@router.post("/rename")
def rename(body: RenameBody, request: Request,
           c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(body.path)
    if p == "/":
        raise HTTPException(400, "Can't rename the top folder")
    dst = posixpath.join(posixpath.dirname(p), check_name(body.new_name))
    try:
        with sftp_for(c) as s:
            if exists(s, dst):
                raise HTTPException(409, "That name already exists")
            s.rename(p, dst)
    except Exception as e:
        fail(e)
    audit(panel_user, request.client.host, "fs_rename", target=c.user, path=p, to=dst)
    return {"ok": True}


def free_copy_name(s, dest, name):
    stem, ext = posixpath.splitext(name)
    for i in range(1, 100):
        label = " (copy)" if i == 1 else f" (copy {i})"
        cand = posixpath.join(dest, f"{stem}{label}{ext}")
        if not exists(s, cand):
            return cand
    raise HTTPException(409, "Too many copies of this name")


def transfer(op, body, request, c, panel_user):
    dest = clean(body.dest)
    plan = []
    try:
        with sftp_for(c) as s:
            if not stat.S_ISDIR(s.stat(dest).st_mode or 0):
                raise HTTPException(400, "The destination is not a folder")
            for raw in body.paths:
                src = clean(raw)
                name = posixpath.basename(src)
                if src == "/" or not name:
                    raise HTTPException(400, "Invalid source")
                if dest == src or dest.startswith(src.rstrip("/") + "/"):
                    raise HTTPException(400, "Can't put a folder inside itself")
                if op == "move" and posixpath.dirname(src) == dest:
                    continue
                target = posixpath.join(dest, name)
                if exists(s, target):
                    if op == "move" or not body.auto_rename:
                        raise HTTPException(409, f'"{name}" already exists in the destination')
                    target = free_copy_name(s, dest, name)
                plan.append((src, target))
    except Exception as e:
        fail(e)
    for src, target in plan:
        argv = ["cp", "-a", "--", src, target] if op == "copy" else ["mv", "--", src, target]
        code, _, err = run(c, argv)
        if code != 0:
            audit(panel_user, request.client.host, "fs_" + op, target=c.user, path=src, to=target, ok=False)
            raise HTTPException(400, err.strip()[:300] or f"The {op} failed")
    audit(panel_user, request.client.host, "fs_" + op, target=c.user, paths=body.paths[:20], to=dest, ok=True)
    return {"ok": True}


@router.post("/copy")
def copy(body: MoveBody, request: Request,
         c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    return transfer("copy", body, request, c, panel_user)


@router.post("/move")
def move(body: MoveBody, request: Request,
         c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    return transfer("move", body, request, c, panel_user)


@router.post("/delete")
def delete(body: PathsBody, request: Request,
           c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    paths = [clean(x) for x in body.paths]
    home = posixpath.normpath(c.home)
    for p in paths:
        if p == "/" or p == home:
            raise HTTPException(400, f"Refusing to delete {p}")
    code, _, err = run(c, ["rm", "-rf", "--", *paths])
    audit(panel_user, request.client.host, "fs_delete", target=c.user, paths=paths[:20], ok=(code == 0))
    if code != 0:
        raise HTTPException(400, err.strip()[:300] or "The delete failed")
    return {"ok": True}


@router.post("/chmod")
def chmod(body: ChmodBody, request: Request,
          c: Conn = Depends(conn_dep), panel_user: str = Depends(current_user)):
    p = clean(body.path)
    try:
        with sftp_for(c) as s:
            s.chmod(p, int(body.mode, 8))
    except Exception as e:
        fail(e)
    audit(panel_user, request.client.host, "fs_chmod", target=c.user, path=p, mode=body.mode)
    return {"ok": True}
