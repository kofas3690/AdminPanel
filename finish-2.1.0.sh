#!/bin/bash
# Run inside ~/adminpanel AFTER `git am` of the 2.1.0 patch (which comes after the 2.0.1 patch and its finish script).
set -e
sed -i -E -e 's/version [0-9]+\.[0-9]+\.[0-9]+/version 2.1.0/' -e 's/Version [0-9]+\.[0-9]+\.[0-9]+\./Version 2.1.0./' -e 's/adminpanel_[0-9]+\.[0-9]+\.[0-9]+_all/adminpanel_2.1.0_all/g' README.md docs/INSTALL.md
python3 - <<'PY'
s = open("RELEASE_NOTES.md").read()
if "## v2.1.0" in s:
    raise SystemExit("RELEASE_NOTES.md already has v2.1.0; nothing to do")
new = open("docs/release-v2.1.0.md").read().rstrip()
head = "## v2.1.0: Login history (2026-11-09)\n\n" + new + "\n\n---\n\n"
i = s.index("## v2.0.1")
open("RELEASE_NOTES.md", "w").write(s[:i] + head + s[i:])
PY
git status --short
