#!/bin/bash
# Optional: installs the package in a fresh Ubuntu VM made with Multipass.
#   packaging/test-multipass.sh dist/adminpanel_0.9.0_all.deb [22.04|24.04]
set -euo pipefail
DEB="${1:?path to the .deb}"; REL="${2:-24.04}"; NAME="ap-test-$(date +%s)"
multipass launch "$REL" --name "$NAME" --cpus 2 --memory 2G --disk 12G
multipass transfer "$DEB" "$NAME:/tmp/adminpanel.deb"
multipass exec "$NAME" -- sudo apt-get update -qq
multipass exec "$NAME" -- sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/adminpanel.deb
multipass exec "$NAME" -- sudo adminpanel-setup ssh
multipass exec "$NAME" -- sudo adminpanel-setup tls
multipass exec "$NAME" -- sudo adminpanel-selfcheck || true
echo
echo "The VM '$NAME' is still running. Finish the setup with:"
echo "  multipass shell $NAME      then:  sudo adminpanel-setup user && sudo adminpanel-setup 2fa"
echo "Delete it with:  multipass delete --purge $NAME"
