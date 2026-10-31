import base64, hashlib, io
import paramiko
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from auth import current_user
from audit import audit

router = APIRouter(prefix="/api/sshkeys")

MAX_KEY = 16384
AUTHORIZED_OPTIONS = 'from="127.0.0.1,::1",no-agent-forwarding,no-X11-forwarding,no-port-forwarding'


def normalize_key(text):
    """Checks that text looks like a private key file. Raises ValueError with a friendly message."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("no private key was provided")
    t = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if t.startswith("PuTTY-User-Key-File"):
        raise ValueError("that is a PuTTY .ppk file. In PuTTYgen choose Conversions, then Export OpenSSH key, and use the exported file")
    if t.startswith(("ssh-", "ecdsa-", "sk-")):
        raise ValueError("that is a public key. Use the private key file (the one without .pub)")
    if len(t) > MAX_KEY:
        raise ValueError("that is too large to be a private key")
    lines = t.split("\n")
    first, last = lines[0].strip(), lines[-1].strip()
    if not (first.startswith("-----BEGIN ") and first.endswith("PRIVATE KEY-----")
            and last.startswith("-----END ") and last.endswith("PRIVATE KEY-----")):
        raise ValueError("that does not look like a private key. Use the whole file, from the -----BEGIN line to the -----END line")
    if any(not (c == "\n" or 32 <= ord(c) < 127) for c in t):
        raise ValueError("a private key file contains only plain text characters")
    return t + "\n"


def load_pkey(text, passphrase=""):
    """Loads a private key for paramiko. Raises HTTPException with a friendly message."""
    try:
        t = normalize_key(text)
    except ValueError as e:
        raise HTTPException(400, str(e))
    pw = passphrase or None
    needs_pw = False
    for cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        try:
            return cls.from_private_key(io.StringIO(t), password=pw)
        except paramiko.PasswordRequiredException:
            needs_pw = True
            break
        except Exception:
            continue
    if needs_pw:
        raise HTTPException(400, "This key is protected by a passphrase. Enter it.")
    raise HTTPException(400, "Could not read that key. Check that it is an OpenSSH or PEM private key (Ed25519, RSA or ECDSA) and that the passphrase is right.")


class GenBody(BaseModel):
    comment: str = Field(default="admin-panel", pattern=r"^[A-Za-z0-9 ._@-]{0,40}$")
    passphrase: str = Field(default="", max_length=256)


@router.post("/generate")
def generate(body: GenBody, request: Request, user: str = Depends(current_user)):
    if body.passphrase and len(body.passphrase) < 8:
        raise HTTPException(400, "Use a passphrase of at least 8 characters, or leave it empty")
    key = ed25519.Ed25519PrivateKey.generate()
    try:
        enc = (serialization.BestAvailableEncryption(body.passphrase.encode())
               if body.passphrase else serialization.NoEncryption())
        private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.OpenSSH, enc).decode()
    except Exception:
        raise HTTPException(500, "Could not protect the key with a passphrase on this system")
    pub = key.public_key().public_bytes(serialization.Encoding.OpenSSH,
                                        serialization.PublicFormat.OpenSSH).decode()
    comment = body.comment.strip() or "admin-panel"
    fp = "SHA256:" + base64.b64encode(hashlib.sha256(base64.b64decode(pub.split()[1])).digest()).decode().rstrip("=")
    # never log the key itself
    audit(user, request.client.host, "sshkey_generated", encrypted=bool(body.passphrase))
    return JSONResponse({"private": private, "public": f"{pub} {comment}", "fingerprint": fp,
                         "authorized_line": f"{AUTHORIZED_OPTIONS} {pub} {comment}"},
                        headers={"Cache-Control": "no-store"})
