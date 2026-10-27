import asyncio, errno, os, pwd, secrets, shutil, stat
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/files")

# location name -> (folder, writable). Edit this list to add or remove locations.
ROOTS = {
    "files": (Path("/srv/panel-files"), True),
    "logs": (Path("/var/log"), False),
}

MAX_UPLOAD = 100 * 1024 * 1024      # keep in step with nginx (110m)
RESERVE = 512 * 1024 * 1024         # never let an upload leave less than this free
MAX_EDIT = 256 * 1024
MAX_LIST = 5000

APP_DIR = Path(__file__).resolve().parent
for _name, (_p, _w) in ROOTS.items():
    _r = _p.resolve()
    if _r == APP_DIR or APP_DIR in _r.parents or _r in APP_DIR.parents:
        raise RuntimeError(f"location {_name!r} must not contain or sit inside the panel's own folder")


def fail(e):
    if isinstance(e, FileNotFoundError):
        raise HTTPException(404, "Not found")
    if isinstance(e, PermissionError):
        raise HTTPException(403, "Permission denied")
    if isinstance(e, FileExistsError):
        raise HTTPException(409, "Already exists")
    if isinstance(e, IsADirectoryError):
        raise HTTPException(400, "That is a folder")
    if isinstance(e, NotADirectoryError):
        raise HTTPException(400, "That is not a folder")
    if e.errno == errno.ENOTEMPTY:
        raise HTTPException(409, "Folder is not empty")
    if e.errno == errno.ENOSPC:
        raise HTTPException(507, "No space left on device")
    if e.errno == errno.ELOOP:
        raise HTTPException(400, "Symbolic links are not followed")
    raise HTTPException(500, e.strerror or "I/O error")


def check_name(name):
    try:
        ok = 0 < len(name.encode("utf-8")) <= 255
    except UnicodeEncodeError:
        ok = False
    if not ok or name in (".", "..") or "/" in name or "\x00" in name:
        raise HTTPException(400, "Invalid name")
    return name


def root_of(name, write=False):
    if name not in ROOTS:
        raise HTTPException(404, "Unknown location")
    base, writable = ROOTS[name]
    if write and not writable:
        raise HTTPException(403, "This location is read-only")
    return base


def resolve(root, rel, write=False, final_link_ok=False):
    base = root_of(root, write)
    parts = [check_name(p) for p in rel.split("/") if p != ""]
    cur = base
    for i, part in enumerate(parts):
        cur = cur / part
        try:
            st = os.lstat(cur)
        except OSError:
            continue
        if stat.S_ISLNK(st.st_mode) and not (final_link_ok and i == len(parts) - 1):
            raise HTTPException(400, "Symbolic links are not followed")
    return base, cur


def write_all(fd, data):
    view = memoryview(data)
    while len(view):
        n = os.write(fd, view)
        view = view[n:]


@router.get("/roots")
def roots(user: str = Depends(current_user)):
    return [{"name": n, "writable": w} for n, (p, w) in ROOTS.items()]


@router.get("/list")
def list_dir(root: str, path: str = "", user: str = Depends(current_user)):
    base, target = resolve(root, path)
    items, truncated = [], False
    try:
        with os.scandir(target) as it:
            for e in it:
                if len(items) >= MAX_LIST:
                    truncated = True
                    break
                try:
                    st = e.stat(follow_symlinks=False)
                except OSError:
                    continue
                name, unsafe = e.name, False
                try:
                    name.encode("utf-8")
                except UnicodeEncodeError:
                    name = e.name.encode("utf-8", "surrogateescape").decode("utf-8", "replace")
                    unsafe = True
                mode = st.st_mode
                kind = ("link" if stat.S_ISLNK(mode) else "dir" if stat.S_ISDIR(mode)
                        else "file" if stat.S_ISREG(mode) else "other")
                try:
                    owner = pwd.getpwuid(st.st_uid).pw_name
                except KeyError:
                    owner = str(st.st_uid)
                items.append({
                    "name": name, "type": kind, "size": st.st_size, "mtime": st.st_mtime,
                    "mode": stat.filemode(mode), "owner": owner, "unsafe": unsafe,
                    "readable": kind in ("file", "dir") and os.access(e.path, os.R_OK),
                })
    except OSError as err:
        fail(err)
    items.sort(key=lambda x: (x["type"] != "dir", x["name"].lower()))
    return {"items": items, "truncated": truncated, "writable": ROOTS[root][1]}


@router.get("/download")
def download(root: str, path: str, request: Request, user: str = Depends(current_user)):
    base, target = resolve(root, path)
    if target == base:
        raise HTTPException(400, "Not a file")
    try:
        st = os.lstat(target)
    except OSError as e:
        fail(e)
    if not stat.S_ISREG(st.st_mode):
        raise HTTPException(400, "Not a regular file")
    if not os.access(target, os.R_OK):
        raise HTTPException(403, "Permission denied")
    audit(user, request.client.host, "file_download", root=root, path=path, bytes=st.st_size)
    return FileResponse(target, media_type="application/octet-stream",
                        filename=target.name,
                        headers={"X-Content-Type-Options": "nosniff"})


@router.get("/read")
def read_text(root: str, path: str, request: Request, user: str = Depends(current_user)):
    base, target = resolve(root, path)
    if target == base:
        raise HTTPException(400, "Not a file")
    try:
        fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError as e:
        fail(e)
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            raise HTTPException(400, "Not a regular file")
        if st.st_size > MAX_EDIT:
            raise HTTPException(413, "File is too large to edit here (limit 256 KB)")
        with os.fdopen(fd, "rb", closefd=False) as f:
            data = f.read(MAX_EDIT + 1)
    except OSError as e:
        fail(e)
    finally:
        os.close(fd)
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, "Not a UTF-8 text file")
    if "\x00" in text:
        raise HTTPException(415, "Not a text file")
    audit(user, request.client.host, "file_read", root=root, path=path)
    return {
        "text": text,
        "mtime_ns": str(st.st_mtime_ns),
        "writable": ROOTS[root][1] and os.access(target, os.W_OK),
    }


class PathBody(BaseModel):
    root: str
    path: str


class WriteBody(PathBody):
    text: str = Field(max_length=MAX_EDIT)
    mtime_ns: str


class RenameBody(PathBody):
    new_name: str


class DeleteBody(PathBody):
    recursive: bool = False


@router.put("/write")
def write_text(body: WriteBody, request: Request, user: str = Depends(current_user)):
    base, target = resolve(body.root, body.path, write=True)
    try:
        data = body.text.encode("utf-8")
    except UnicodeEncodeError:
        raise HTTPException(400, "Text contains invalid characters")
    if len(data) > MAX_EDIT:
        raise HTTPException(413, "Text is too large (limit 256 KB)")
    try:
        st = os.lstat(target)
    except OSError as e:
        fail(e)
    if not stat.S_ISREG(st.st_mode):
        raise HTTPException(400, "Not a regular file")
    if str(st.st_mtime_ns) != body.mtime_ns:
        raise HTTPException(409, "The file changed on disk since you opened it. Close and reopen it.")
    tmp = target.with_name(f".panel-{secrets.token_hex(4)}.tmp")
    try:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as f:
            os.fchmod(f.fileno(), stat.S_IMODE(st.st_mode))
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, target)
    except OSError as e:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        fail(e)
    audit(user, request.client.host, "file_write", root=body.root, path=body.path, bytes=len(data))
    return {"ok": True, "mtime_ns": str(os.stat(target).st_mtime_ns)}


@router.post("/mkdir")
def mkdir(body: PathBody, request: Request, user: str = Depends(current_user)):
    base, target = resolve(body.root, body.path, write=True)
    if target == base:
        raise HTTPException(400, "Invalid name")
    try:
        os.mkdir(target, 0o750)
    except OSError as e:
        fail(e)
    audit(user, request.client.host, "file_mkdir", root=body.root, path=body.path)
    return {"ok": True}


@router.post("/rename")
def rename(body: RenameBody, request: Request, user: str = Depends(current_user)):
    base, src = resolve(body.root, body.path, write=True, final_link_ok=True)
    if src == base:
        raise HTTPException(400, "Can't rename the top folder")
    dst = src.with_name(check_name(body.new_name))
    if os.path.lexists(dst):
        raise HTTPException(409, "A file or folder with that name already exists")
    try:
        os.rename(src, dst)
    except OSError as e:
        fail(e)
    audit(user, request.client.host, "file_rename", root=body.root, path=body.path, to=body.new_name)
    return {"ok": True}


@router.post("/delete")
def delete(body: DeleteBody, request: Request, user: str = Depends(current_user)):
    base, target = resolve(body.root, body.path, write=True, final_link_ok=True)
    if target == base:
        raise HTTPException(400, "Can't delete the top folder")
    try:
        st = os.lstat(target)
        if stat.S_ISDIR(st.st_mode):
            if body.recursive:
                shutil.rmtree(target)
            else:
                os.rmdir(target)
        else:
            os.unlink(target)
    except OSError as e:
        audit(user, request.client.host, "file_delete", root=body.root, path=body.path,
              recursive=body.recursive, ok=False)
        fail(e)
    audit(user, request.client.host, "file_delete", root=body.root, path=body.path,
          recursive=body.recursive, ok=True)
    return {"ok": True}


@router.put("/upload")
async def upload(request: Request, root: str, path: str, overwrite: bool = False,
                 user: str = Depends(current_user)):
    base, target = resolve(root, path, write=True)
    if target == base:
        raise HTTPException(400, "Invalid name")
    parent = target.parent
    try:
        if not stat.S_ISDIR(os.lstat(parent).st_mode):
            raise HTTPException(400, "The destination is not a folder")
    except OSError as e:
        fail(e)
    if os.path.lexists(target):
        if not overwrite:
            raise HTTPException(409, "A file with that name already exists")
        if not stat.S_ISREG(os.lstat(target).st_mode):
            raise HTTPException(400, "Can't replace that")

    cl = request.headers.get("content-length", "")
    declared = int(cl) if cl.isdigit() else None
    if declared is not None and declared > MAX_UPLOAD:
        raise HTTPException(413, "File is too large (limit 100 MB)")
    need = declared if declared is not None else MAX_UPLOAD
    if shutil.disk_usage(parent).free - need < RESERVE:
        raise HTTPException(507, "Not enough free space on this disk")

    tmp = parent / f".upload-{secrets.token_hex(4)}.tmp"
    fd, total, done = -1, 0, False
    try:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o640)
        async for chunk in request.stream():
            total += len(chunk)
            if total > MAX_UPLOAD:
                raise HTTPException(413, "File is too large (limit 100 MB)")
            await asyncio.to_thread(write_all, fd, chunk)
        await asyncio.to_thread(os.fsync, fd)
        os.replace(tmp, target)
        done = True
    except OSError as e:
        fail(e)
    finally:
        if fd != -1:
            os.close(fd)
        if not done:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    audit(user, request.client.host, "file_upload", root=root, path=path, bytes=total)
    return {"ok": True, "bytes": total}
