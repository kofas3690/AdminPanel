"""Client side of the bridge: asks `adminpanel-bridge` on another machine to do one thing.

One short SSH connection per call. The other machine's host key must already be in a root-owned
known-hosts file (REMOTE_KNOWN_HOSTS), the same way the local Terminal pins this machine's key, so
the panel cannot be tricked into talking to an impostor and cannot change the file itself.
"""
import json, os, re, threading
from pathlib import Path

import paramiko

from store import PersistentDict

hosts = PersistentDict("remote_hosts")                   # id -> {name, address, port, user, key}
REMOTE_KNOWN_HOSTS = Path("/var/lib/adminpanel/remote_known_hosts")
KEY_DIR = Path(os.environ.get("ADMINPANEL_DATA", Path(__file__).parent))
MAX_ANSWER = 1024 * 1024
TIMEOUT = 15
HOST_ID = re.compile(r"^[0-9a-f]{8}$")
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
