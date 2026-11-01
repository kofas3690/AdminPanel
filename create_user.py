import getpass, json, sys
from pathlib import Path
from argon2 import PasswordHasher

USERS = Path("users.json")
ph = PasswordHasher()

MIN_PASSWORD = 8
TRIES = 3

username = input("Username: ").strip()
if not username:
    sys.exit("The username cannot be empty")
print(f"The password must be at least {MIN_PASSWORD} characters long. A longer phrase is safer.")
for attempt in range(TRIES):
    password = getpass.getpass(f"Password (at least {MIN_PASSWORD} characters): ")
    if len(password) < MIN_PASSWORD:
        print(f"Too short: that is {len(password)} characters. Use at least {MIN_PASSWORD}.")
        continue
    if password != getpass.getpass("Repeat the password: "):
        print("The two passwords differ. Try again.")
        continue
    break
else:
    sys.exit("No valid password was entered")

users = json.loads(USERS.read_text()) if USERS.exists() else {}
rec = users.get(username, {})
if isinstance(rec, str):
    rec = {}
rec["hash"] = ph.hash(password)
users[username] = rec
USERS.write_text(json.dumps(users, indent=2))
USERS.chmod(0o600)
print("Saved", username)
