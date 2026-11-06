"""Client side of the bridge: asks `adminpanel-bridge` on another machine to do one thing.

One short SSH connection per call. The other machine's host key must already be in a root-owned
known-hosts file (REMOTE_KNOWN_HOSTS), the same way the local Terminal pins this machine's key, so
the panel cannot be tricked into talking to an impostor and cannot change the file itself.
"""
import json, os, re, threading
from pathlib import Path

import paramiko
from fastapi import APIRouter, Depends

from auth import current_user
from store import PersistentDict

router = APIRouter(prefix="/api/remote")

hosts = PersistentDict("remote_hosts")                   # id -> {name, address, port, user, key}
REMOTE_KNOWN_HOSTS = Path(os.environ.get("ADMINPANEL_STATE", "/var/lib/adminpanel")) / "remote_known_hosts"
# The panel's private key for other machines lives in the root-owned state folder: the panel can
# read it (group adminpanel) but cannot replace it. `adminpanel-setup remote-key` creates it.
KEY_DIR = Path(os.environ.get("ADMINPANEL_STATE", "/var/lib/adminpanel"))
MAX_ANSWER = 1024 * 1024
TIMEOUT = 15
HOST_ID = re.compile(r"^[0-9a-f]{8}$")
NAME_OK = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$")
ADDRESS_OK = re.compile(r"^[A-Za-z0-9._:-]{1,253}$")
MAX_HOSTS = 50
_lock = threading.Lock()


class RemoteError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def get_host(host_id):
    if not isinstance(host_id, str) or not HOST_ID.match(host_id):
        raise RemoteError(404, "Unknown server")
    rec = hosts.get(host_id)
    if rec is None:
        raise RemoteError(404, "Unknown server")
    return rec


def call(host_id, op, args=None):
    """Runs one bridge operation on a listed server and returns its result."""
    rec = get_host(host_id)
    if not REMOTE_KNOWN_HOSTS.exists():
        raise RemoteError(502, "No host keys are pinned for remote servers yet")
    client = paramiko.SSHClient()
    client.load_host_keys(str(REMOTE_KNOWN_HOSTS))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect(rec["address"], port=rec.get("port", 22), username=rec["user"],
                       key_filename=str(KEY_DIR / rec["key"]), look_for_keys=False, allow_agent=False,
                       timeout=TIMEOUT, banner_timeout=TIMEOUT, auth_timeout=TIMEOUT)
        stdin, stdout, _ = client.exec_command("adminpanel-bridge", timeout=TIMEOUT)
        stdin.write(json.dumps({"id": 1, "op": op, "args": args or {}}) + "\n")
        stdin.flush()
        stdin.channel.shutdown_write()
        line = stdout.readline(MAX_ANSWER + 1)
    except paramiko.BadHostKeyException:
        raise RemoteError(502, "The server's host key has changed")
    except paramiko.SSHException as e:
        if "not found in known_hosts" in str(e):
            raise RemoteError(502, "The server's host key is not pinned")
        raise RemoteError(502, "Could not sign in to that server")
    except OSError:
        raise RemoteError(502, "Could not reach that server")
    finally:
        client.close()
    if not line or len(line) > MAX_ANSWER:
        raise RemoteError(502, "No usable answer from that server")
    try:
        ans = json.loads(line)
    except ValueError:
        raise RemoteError(502, "No usable answer from that server")
    if not isinstance(ans, dict) or ans.get("id") != 1:
        raise RemoteError(502, "No usable answer from that server")
    if not ans.get("ok"):
        st = ans.get("status")
        raise RemoteError(st if st in (400, 403, 404, 413, 500) else 502,
                          str(ans.get("error", "failed"))[:200])
    return ans.get("result")


# ------------------------------------------------------------------ the list of servers
# These three are used by `adminpanel-setup add-host / remove-host / list-hosts`, which run them as
# the panel's own account so the database keeps the right owner.
def add_host(name, address, port=22, user="adminpanel-remote", key="remote_key"):
    """Adds a server to the list and returns its id. Raises ValueError with a plain message."""
    if not isinstance(name, str) or not NAME_OK.match(name):
        raise ValueError("The name may use letters, digits, dot, dash and underscore (up to 40 characters)")
    if not isinstance(address, str) or not ADDRESS_OK.match(address) or address.startswith(("-", ".")):
        raise ValueError("That is not a valid address")
    if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
        raise ValueError("The port must be a number from 1 to 65535")
    with _lock:
        items = hosts.items()
        if len(items) >= MAX_HOSTS:
            raise ValueError(f"At most {MAX_HOSTS} servers can be listed")
        for _hid, rec in items:
            if rec["name"].lower() == name.lower():
                raise ValueError("A server with that name is already in the list")
            if rec["address"].lower() == address.lower() and rec.get("port", 22) == port:
                raise ValueError("That address is already in the list")
        hid = os.urandom(4).hex()
        hosts[hid] = {"name": name, "address": address, "port": port, "user": user, "key": key}
    return hid


def find_host(name):
    for hid, rec in hosts.items():
        if rec["name"].lower() == str(name).lower():
            return hid
    return None


def remove_host(name):
    hid = find_host(name)
    if hid is None:
        raise ValueError("No server with that name")
    hosts.pop(hid, None)
    return hid


def list_hosts():
    return sorted(((hid, rec["name"], rec["address"], rec.get("port", 22)) for hid, rec in hosts.items()),
                  key=lambda r: r[1].lower())


@router.get("/hosts")
def api_hosts(user: str = Depends(current_user)):
    """The listed machines, for the Remote services page. Only the id, name and address."""
    return [{"id": hid, "name": name, "address": addr, "port": port}
            for hid, name, addr, port in list_hosts()]
