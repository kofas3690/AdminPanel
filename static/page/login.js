document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const go = document.getElementById("go"), err = document.getElementById("err");
  go.disabled = true;
  err.textContent = "";
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("u").value,
        password: document.getElementById("p").value,
        code: document.getElementById("c").value,
      }),
    });
    if (r.ok) { location.href = "/"; return; }
    let msg = "Sign-in failed";
    try { const j = await r.json(); if (typeof j.detail === "string") msg = j.detail; } catch (x) {}
    err.textContent = msg;
  } catch (x) {
    err.textContent = "Could not reach the server";
  }
  go.disabled = false;
});
