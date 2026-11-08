"""Sending the alert emails.

The settings (server, port, addresses) are saved in the panel database. The password is kept in its own
file in the data folder (readable only by the panel account), is never sent back to the browser, and
is only ever used to log in to the mail server. Connections must be encrypted (STARTTLS or SSL) and the
server's certificate is checked, so the password never crosses the network in the clear.
"""
import re, smtplib, socket, ssl
from email.message import EmailMessage
from typing import Optional
from paths import DATA
from store import PersistentDict

store = PersistentDict("mail_settings")
PASSWORD_FILE = DATA / "smtp_password"
HOST_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?")
ADDR_RE = re.compile(r"[^@\s,;<>\"']{1,64}@[A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,}")
DEFAULTS = {"enabled": False, "host": "", "port": 587, "security": "starttls", "username": "", "sender": "", "to": []}


class MailError(Exception):
    pass


def get():
    s = dict(DEFAULTS)
    s.update(store.get("cfg") or {})
    return s


def has_password():
    try:
        return PASSWORD_FILE.stat().st_size > 0
    except OSError:
        return False


def _password():
    try:
        return PASSWORD_FILE.read_text().strip()
    except OSError:
        return ""


def set_password(pw):
    import os
    fd = os.open(PASSWORD_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(pw)


def validate(c, password: Optional[str]):
    if c["host"] and not HOST_RE.fullmatch(c["host"]):
        raise MailError("The mail server name is not valid")
    if not 1 <= c["port"] <= 65535:
        raise MailError("The port must be between 1 and 65535")
    if c["security"] not in ("starttls", "ssl"):
        raise MailError("Choose STARTTLS or SSL; unencrypted mail is not allowed")
    if c["username"] and (len(c["username"]) > 200 or any(ord(ch) < 32 for ch in c["username"])):
        raise MailError("The user name is not valid")
    if c["sender"] and not ADDR_RE.fullmatch(c["sender"]):
        raise MailError("The 'From' address is not valid")
    if len(c["to"]) > 5 or any(not ADDR_RE.fullmatch(a) for a in c["to"]):
        raise MailError("Give up to 5 valid 'To' addresses")
    if password is not None and (len(password) > 200 or any(ord(ch) < 32 for ch in password)):
        raise MailError("The password is not valid")
    if c["enabled"] and not (c["host"] and c["sender"] and c["to"]):
        raise MailError("To turn email on, fill in the server, the 'From' address and at least one 'To' address")


def send(subject, body, cfg=None):
    c = cfg or get()
    if not (c["host"] and c["sender"] and c["to"]):
        raise MailError("Email is not set up yet")
    msg = EmailMessage()
    msg["Subject"] = subject.replace("\r", " ").replace("\n", " ")[:200]
    msg["From"] = c["sender"]
    msg["To"] = ", ".join(c["to"])
    msg.set_content(body)
    ctx = ssl.create_default_context()
    try:
        if c["security"] == "ssl":
            s = smtplib.SMTP_SSL(c["host"], c["port"], timeout=15, context=ctx)
        else:
            s = smtplib.SMTP(c["host"], c["port"], timeout=15)
        with s:
            s.ehlo()
            if c["security"] == "starttls":
                s.starttls(context=ctx)
                s.ehlo()
            pw = _password()
            if c["username"] and pw:
                s.login(c["username"], pw)
            s.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        raise MailError("The mail server refused the user name or password")
    except ssl.SSLError as e:
        raise MailError("The secure connection failed: " + str(getattr(e, "reason", e))[:100])
    except (OSError, smtplib.SMTPException, socket.timeout) as e:
        raise MailError("Could not send: " + str(e)[:150])
