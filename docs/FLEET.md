# Servers page

The **Servers** page (System > Servers) lists other AdminPanel servers you manage, shows whether each one is up and which version it runs, and opens its panel in a new tab.

It is a list, not remote control. Each server keeps its own administrators, 2FA and audit log, and you sign in to each one separately. Nothing is proxied and no password or key is shared.

## Add a server

1. Install AdminPanel on the other machine (1.0.4 or later, so that it answers the status request).
2. On this panel open **Servers**, press **Add a server**, type its address, for example `https://192.168.1.20:8443/`, and press **Look up**.
3. Compare the fingerprint shown with the one on the other machine:

   ```bash
   openssl x509 -in /etc/ssl/certs/adminpanel.crt -noout -fingerprint -sha256
   ```

4. Give it a name and press **The fingerprint matches: add it**.

## What this panel asks the other server

One request, `GET /api/health`, which needs no login and answers only `{"app": "adminpanel", "version": "..."}`. Every panel from 1.0.4 answers it. Nothing else is read from the other server.

## Safety rules

- Only `https://` addresses; no user name, path or query. Link-local addresses (169.254.x.x, fe80::) are refused so the page cannot be used to reach cloud metadata services.
- The other server's certificate is pinned by its SHA-256 fingerprint when you add it. If it ever shows a different certificate, the row turns to **Certificate changed**, no version is trusted, and **Trust new certificate** asks you to confirm the new fingerprint.
- Each check gives up after 4 seconds, reads at most 4 KB, and never follows a redirect.
- Up to 50 servers. Adding, re-pinning and removing a server are written to the audit log (`fleet_host_added`, `fleet_host_repinned`, `fleet_host_removed`).
- Links open with `rel="noopener noreferrer"`, and only stored `https://` addresses are ever made into links.

## Known limitations

- A panel that is older than 1.0.4 shows as **Not AdminPanel** until it is upgraded.
- The list is stored on this panel only. It is not copied to the other servers.
