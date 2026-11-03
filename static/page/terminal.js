const TERM_THEMES = {
  dark: { background: "#000000" },
  light: { background: "#ffffff", foreground: "#1f2328", cursor: "#1f2328", cursorAccent: "#ffffff",
    selectionBackground: "#b6d4f5",
    black: "#24292f", red: "#cf222e", green: "#116329", yellow: "#4d2d00", blue: "#0969da",
    magenta: "#8250df", cyan: "#1b7c83", white: "#6e7781",
    brightBlack: "#57606a", brightRed: "#a40e26", brightGreen: "#1a7f37", brightYellow: "#633c01",
    brightBlue: "#218bff", brightMagenta: "#a475f9", brightCyan: "#3192aa", brightWhite: "#8c959f" },
};
const term = new Terminal({ cursorBlink: true, fontSize: 14, scrollback: 5000,
                            theme: TERM_THEMES[AdminTheme.get()] });
window.addEventListener("themechange", (e) => { term.options.theme = TERM_THEMES[e.detail]; });
const fit = new FitAddon.FitAddon();
term.loadAddon(fit);
term.open(document.getElementById("term"));
fit.fit();

const enc = new TextEncoder();
let ws = null;

function setState(text, connected) {
  document.getElementById("state").textContent = text;
  document.getElementById("connect").disabled = connected;
  document.getElementById("disconnect").disabled = !connected;
}

function connect() {
  if (ws) return;
  const user = document.getElementById("luser").value.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,31}$/.test(user)) { alert("Invalid user name"); return; }
  term.reset();
  fit.fit();
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}/api/terminal/ws` +
    `?u=${encodeURIComponent(user)}&cols=${term.cols}&rows=${term.rows}`;
  const sock = new WebSocket(url);
  sock.binaryType = "arraybuffer";
  let opened = false;
  ws = sock;
  setState("connecting…", true);
  sock.onopen = () => { opened = true; setState("connected", true); term.focus(); };
  sock.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data));
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    setState("disconnected", false);
    term.write(opened
      ? "\r\n[connection closed]\r\n"
      : "\r\n[could not connect: not logged in, too many terminals open, or the host key file is missing]\r\n");
  };
}

term.onData((d) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(enc.encode(d));
});

term.onResize(({ cols, rows }) => {
  if (ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: "resize", cols, rows }));
});

window.addEventListener("resize", () => fit.fit());
document.getElementById("connect").onclick = connect;
document.getElementById("disconnect").onclick = () => { if (ws) ws.close(); };
