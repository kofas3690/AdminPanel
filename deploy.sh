#!/bin/sh
set -eu
SRC="$HOME/adminpanel/"
DST=/opt/adminpanel/

if pgrep -x apt-get >/dev/null || pgrep -x dpkg >/dev/null || pgrep -f "adminpanel-disk apply" >/dev/null; then
  echo "apt/dpkg is running; not deploying now." >&2
  exit 1
fi

OUT=$(sudo rsync -ai \
  --exclude .venv --exclude __pycache__ --exclude '*.pyc' \
  --exclude data --exclude users.json --exclude audit.log \
  --exclude .git --exclude .gitignore --exclude deploy.sh --exclude system \
  --exclude packaging --exclude docs --exclude screenshots --exclude '*.bak*' \
  --exclude '*.md' --exclude LICENSE --exclude ssh_known_hosts --exclude panel.db --exclude 'panel.db-*' \
  "$SRC" "$DST")
# the program files belong to root; only data/ belongs to the panel account
sudo find /opt/adminpanel -path /opt/adminpanel/data -prune -o -exec chown root:root {} +
sudo chown root:adminpanel /opt/adminpanel
sudo chmod -R go-w /opt/adminpanel
sudo install -d -m 700 -o adminpanel -g adminpanel /opt/adminpanel/data

if echo "$OUT" | grep -q '\.py$'; then
  echo "Python files changed: restarting the panel (everyone is logged out)."
  sudo systemctl restart adminpanel
else
  echo "Only static files changed: no restart needed."
fi
