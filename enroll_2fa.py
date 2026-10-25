import json, sys
from pathlib import Path
import pyotp, qrcode

USERS = Path("users.json")
users = json.loads(USERS.read_text())

name = input("Username: ").strip()
if name not in users:
    sys.exit("No such user")

rec = users[name]
if isinstance(rec, str):          # old format: just the hash
    rec = {"hash": rec}

secret = pyotp.random_base32()
uri = pyotp.TOTP(secret).provisioning_uri(name=name, issuer_name="AdminPanel")

qr = qrcode.QRCode()
qr.add_data(uri)
qr.print_ascii(invert=True)
print("Can't scan? Enter this key manually:", secret)

code = input("Enter the 6-digit code from your app: ").strip()
if not pyotp.TOTP(secret).verify(code, valid_window=1):
    sys.exit("Wrong code, nothing saved")

rec["totp"] = secret
users[name] = rec
USERS.write_text(json.dumps(users, indent=2))
USERS.chmod(0o600)
print("2FA enabled for", name)
