#!/bin/bash
# Copies the root helpers and the exact Python package versions from THIS (working)
# machine into packaging/live/, so the package matches what you have tested.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
LIVE="$HERE/live"
mkdir -p "$LIVE/sbin"
missing=0
for h in apt ufw users net disk userunits; do
    src="/usr/local/sbin/adminpanel-$h"
    if [ -f "$src" ]; then
        cp "$src" "$LIVE/sbin/adminpanel-$h"
        chmod 644 "$LIVE/sbin/adminpanel-$h"
        echo "captured $src"
    else
        echo "MISSING: $src" >&2
        missing=1
    fi
done
[ "$missing" = 0 ] || { echo "Some helpers are missing. The package needs all six." >&2; exit 1; }

PIP=/opt/adminpanel/.venv/bin/pip
[ -x "$PIP" ] || { echo "No Python environment at /opt/adminpanel/.venv" >&2; exit 1; }
sudo -u adminpanel "$PIP" freeze --exclude-editable | grep -v '^-' > "$LIVE/requirements.lock"
echo "captured $(wc -l < "$LIVE/requirements.lock") pinned Python packages"
