**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.8.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Certificates** (new sidebar entry). A read-only list of the TLS certificates this machine serves: the panel's own, Let's Encrypt, and any that nginx points to. Each shows its names, who issued it (or *Self-signed*), when it expires, how many days are left, and where the file is.
- **Alerts.** A certificate that expires within 21 days raises a warning, within 7 days (or already expired) a critical alert, on the Alerts page and by email if you set that up. The reading is refreshed about once an hour; *Check again* reads it now.
- This page changes nothing and does not renew certificates.

### Security note
- A new read-only root helper, `adminpanel-certs`, with two exact sudo rules (`report` and `check`). It finds the certificate files itself and takes no path from the caller. It only uses the first certificate block of a file and never reads or outputs a private key, and it only follows paths that end up inside `/etc/letsencrypt`, `/etc/ssl`, `/etc/nginx` or `/etc/pki`.
- The remote-management account (Servers page) does **not** get these rules.
