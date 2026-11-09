#!/usr/bin/env bash
# Run inside your AdminPanel repo, after add-hardware-screenshot.sh. Puts ~/logins.png and ~/logins-failed.png in the README gallery.
set -e
cd "$(git rev-parse --show-toplevel)"
for n in logins logins-failed; do [ -f "$HOME/$n.png" ] || { echo "Missing: $HOME/$n.png"; exit 1; }; done
mkdir -p screenshots; cp "$HOME/logins.png" "$HOME/logins-failed.png" screenshots/
if ! grep -q "screenshots/logins.png" README.md; then
python3 - <<'PY'
s = open("README.md").read()
a = "| ![Hardware (2.0)](screenshots/hardware.png) | |\n"
assert a in s, "Hardware row not found: run add-hardware-screenshot.sh first"
open("README.md", "w").write(s.replace(a, "| ![Hardware (2.0)](screenshots/hardware.png) | ![Login history (2.1)](screenshots/logins.png) |\n| ![Failed login attempts (2.1)](screenshots/logins-failed.png) | |\n"))
PY
fi
git add README.md screenshots/logins.png screenshots/logins-failed.png
git commit -m "Add Login history screenshots (2.1)"
echo "Done. Now: git push"
