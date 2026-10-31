#!/bin/bash
# Builds dist/adminpanel_<version>_all.deb from this repository.
#   packaging/build.sh [version] [output-dir]
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/.." && pwd)
VERSION="${1:-$(cat "$HERE/VERSION" 2>/dev/null || echo 0.9.0)}"
OUT="${2:-$ROOT/dist}"
MAINT="${MAINTAINER:-Admin Panel <admin@localhost>}"
FILES="$HERE/files"
LIVE="$HERE/live"

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "==> $*"; }

[[ "$VERSION" =~ ^[0-9][A-Za-z0-9.+~-]*$ ]] || die "invalid version: $VERSION"
command -v dpkg-deb >/dev/null || die "dpkg-deb is required. Build this on Ubuntu or Debian."

MODULES=(app auth audit store system services logs updates firewall users terminal storage storage_admin files fs network security journal units userunits create_user enroll_2fa)
HELPERS=(apt ufw users net disk userunits)

say "Checking the source files"
for m in "${MODULES[@]}"; do [ -f "$ROOT/$m.py" ] || die "missing $m.py in $ROOT"; done
python3 - "$ROOT" "${MODULES[*]}" <<'PY'
import ast, sys
from pathlib import Path
root, mods = Path(sys.argv[1]), set(sys.argv[2].split())
problems = []
for m in sorted(mods):
    try:
        tree = ast.parse((root / f"{m}.py").read_text())
    except SyntaxError as e:
        sys.exit(f"{m}.py has a syntax error: {e}")
    for n in ast.walk(tree):
        names = []
        if isinstance(n, ast.ImportFrom) and n.module and n.level == 0:
            names = [n.module.split(".")[0]]
        elif isinstance(n, ast.Import):
            names = [a.name.split(".")[0] for a in n.names]
        for x in names:
            if (root / f"{x}.py").is_file() and x not in mods:
                problems.append(f"{m}.py imports {x}.py, which is not in the package list")
if problems:
    sys.exit("\n".join(sorted(set(problems))))
print("Python modules OK")
PY
for f in login.html index.html app.css shell.js vendor/xterm.js vendor/xterm.css vendor/addon-fit.js; do
    [ -f "$ROOT/static/$f" ] || die "missing static/$f"
done
for h in "${HELPERS[@]}"; do
    p="$LIVE/sbin/adminpanel-$h"
    [ -f "$p" ] || die "missing $p. Run packaging/collect.sh on your working machine first."
    first=$(head -n 1 "$p")
    if [ "$h" = apt ]; then
        case "$first" in
            '#!/bin/sh'*|'#!/bin/bash'*) ;;
            *) die "$p should start with a shell interpreter line (found: $first)" ;;
        esac
        sh -n "$p" || die "$p has a syntax error"
    else
        [ "$first" = '#!/usr/bin/python3 -I' ] || die "$p should start with #!/usr/bin/python3 -I (found: $first)"
        python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$p" || die "$p has a syntax error"
    fi
done
for f in "$FILES"/usr/share/adminpanel/sudoers/*; do
    visudo -cf "$f" >/dev/null 2>&1 || sudo visudo -cf "$f" >/dev/null 2>&1 || die "invalid sudo rule: $f"
done
echo "sudo rules OK"

say "Staging the package"
STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
PKG="$STAGE/adminpanel_${VERSION}_all"
mkdir -p "$PKG/DEBIAN" "$PKG/opt/adminpanel" "$PKG/usr/local/sbin" "$PKG/usr/sbin" \
         "$PKG/usr/lib/systemd/system" "$PKG/usr/share/adminpanel" "$PKG/usr/share/doc/adminpanel"

for m in "${MODULES[@]}"; do install -m 644 "$ROOT/$m.py" "$PKG/opt/adminpanel/$m.py"; done
cp -a "$ROOT/static" "$PKG/opt/adminpanel/static"
find "$PKG/opt/adminpanel/static" \( -name '*.bak' -o -name '*~' -o -name '.DS_Store' \) -delete
find "$PKG/opt/adminpanel/static" -type d -exec chmod 755 {} +
find "$PKG/opt/adminpanel/static" -type f -exec chmod 644 {} +
echo "$VERSION" > "$PKG/opt/adminpanel/VERSION"; chmod 644 "$PKG/opt/adminpanel/VERSION"

for h in "${HELPERS[@]}"; do install -m 755 "$LIVE/sbin/adminpanel-$h" "$PKG/usr/local/sbin/adminpanel-$h"; done

# On systems where systemd-networkd is not the network manager, refuse to apply network changes.
python3 - "$PKG/usr/local/sbin/adminpanel-net" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1]); s = p.read_text()
anchor = '    need(isinstance(incoming.get("items" if scope == "network" else "wireguard"), dict), "invalid state")\n'
guard = anchor + ('    need(run("systemctl", "is-active", "systemd-networkd").stdout.strip() == "active",\n'
                  '         "systemd-networkd is not the active network manager on this system, so the panel cannot change network settings here")\n')
if 'is-active", "systemd-networkd"' in s:
    print("networkd guard already present")
elif s.count(anchor) == 1:
    p.write_text(s.replace(anchor, guard)); print("added the networkd guard")
else:
    print("WARNING: could not add the networkd guard (the helper differs from what I expected)")
PY

install -m 755 "$FILES/usr/sbin/adminpanel-setup" "$PKG/usr/sbin/adminpanel-setup"
install -m 755 "$FILES/usr/sbin/adminpanel-selfcheck" "$PKG/usr/sbin/adminpanel-selfcheck"
install -m 644 "$FILES"/usr/lib/systemd/system/*.service "$PKG/usr/lib/systemd/system/"
cp -a "$FILES/usr/share/adminpanel/." "$PKG/usr/share/adminpanel/"
if [ -f "$LIVE/requirements.lock" ]; then install -m 644 "$LIVE/requirements.lock" "$PKG/usr/share/adminpanel/requirements.lock"
else echo "NOTE: no packaging/live/requirements.lock. The newest compatible packages will be installed."; fi
find "$PKG/usr/share/adminpanel" -type d -exec chmod 755 {} +
find "$PKG/usr/share/adminpanel" -type f -exec chmod 644 {} +
install -m 644 "$FILES/usr/share/doc/adminpanel/README.md" "$PKG/usr/share/doc/adminpanel/README.md"

say "Checking that no secrets or build leftovers are inside"
leak=$(find "$PKG" \( -name users.json -o -name panel.db -o -name 'panel.db-*' -o -name audit.log -o -name ssh_known_hosts \
        -o -name '*.key' -o -name '*.pem' -o -name .venv -o -name __pycache__ -o -name '*.pyc' -o -name .git \) | head)
[ -z "$leak" ] || die "the package would contain files that must never be shipped:
$leak"

SIZE=$(du -sk --exclude=DEBIAN "$PKG" | cut -f1)
cat > "$PKG/DEBIAN/control" <<CTRL
Package: adminpanel
Version: $VERSION
Section: admin
Priority: optional
Architecture: all
Maintainer: $MAINT
Installed-Size: $SIZE
Depends: python3 (>= 3.10), python3-venv, nginx, openssl, sudo, curl, iproute2, util-linux, systemd, openssh-client, adduser
Recommends: openssh-server, ufw, parted, lvm2, xfsprogs, e2fsprogs, mdadm, cryptsetup, open-iscsi, wireguard-tools, multipath-tools, targetcli-fb
Suggests: squid, targetcli-fb
Description: Web administration panel for Ubuntu and Debian servers
 A browser-based control panel: system overview, services, logs, software
 updates, firewall, accounts, storage (partitions, LVM, RAID, encryption,
 iSCSI), networking (interfaces, VLAN, bridges, bonds, VPN, proxy), a file
 manager and a terminal. Privileged actions run through small root helpers
 with strict validation. After installing, run: sudo adminpanel-setup
CTRL
for s in postinst prerm postrm; do install -m 755 "$HERE/debian/$s" "$PKG/DEBIAN/$s"; done

say "Building"
mkdir -p "$OUT"
dpkg-deb --root-owner-group -Zxz --build "$PKG" "$OUT" >/dev/null
DEB="$OUT/adminpanel_${VERSION}_all.deb"
( cd "$OUT" && sha256sum "adminpanel_${VERSION}_all.deb" > "adminpanel_${VERSION}_all.deb.sha256" )
echo
dpkg-deb -I "$DEB" | sed -n '1,12p'
echo
echo "Built: $DEB ($(du -h "$DEB" | cut -f1))"
cat "$DEB.sha256"
