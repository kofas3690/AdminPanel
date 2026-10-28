import re
from pathlib import Path

LINK = '<link rel="stylesheet" href="/app.css">'
SCRIPT = '<script src="/shell.js" defer></script>'

for p in sorted(Path("static").glob("*.html")):
    if p.name in ("login.html", "index.html"):
        continue
    html = p.read_text()
    if "/app.css" in html:
        print("skip (already done):", p.name)
        continue
    new = re.sub(r"<style>.*?</style>\s*", "", html, flags=re.S)
    new, n = re.subn(r"(<title>.*?</title>)",
                     lambda m: m.group(1) + "\n" + LINK + "\n" + SCRIPT,
                     new, count=1, flags=re.S)
    if n != 1:
        print("NO <title>, left alone:", p.name)
        continue
    p.write_text(new)
    print("converted:", p.name)
