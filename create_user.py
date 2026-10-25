import getpass, json, sys
from pathlib import Path
from argon2 import PasswordHasher

USERS = Path("users.json")
ph = PasswordHasher()

username = input("Username: ").strip()
password = getpass.getpass("Password: ")
if len(password) < 12:
    sys.exit("Use at least 12 characters")
if password != getpass.getpass("Repeat: "):
    sys.exit("Passwords differ")

users = json.loads(USERS.read_text()) if USERS.exists() else {}
rec = users.get(username, {})
if isinstance(rec, str):
    rec = {}
rec["hash"] = ph.hash(password)
users[username] = rec
USERS.write_text(json.dumps(users, indent=2))
USERS.chmod(0o600)
print("Saved", username)
