#!/bin/sh
set -eu
SRC="$HOME/adminpanel/"
DST=/opt/adminpanel/

if pgrep -x apt-get >/dev/null || pgrep -x dpkg >/dev/null; then
  echo "apt/dpkg is running; not deploying now." >&2
  exit 1
fi

OUT=$(sudo rsync -ai \
  --exclude .venv --exclude __pycache__ --exclude '*.pyc' \
  --exclude users.json --exclude audit.log \
  --exclude .git --exclude .gitignore --exclude deploy.sh --exclude system \
  "$SRC" "$DST")
sudo chown -R adminpanel:adminpanel "$DST"

if echo "$OUT" | grep -q '\.py$'; then
  echo "Python files changed: restarting the panel (everyone is logged out)."
  sudo systemctl restart adminpanel
else
  echo "Only static files changed: no restart needed."
fi
