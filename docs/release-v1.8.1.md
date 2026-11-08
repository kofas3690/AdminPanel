**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.8.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Email notifications for alerts.** On the Alerts page, under *Email*, enter your mail server, port, user name, password, a *From* address and up to five *To* addresses, tick **Send alert emails**, and press **Send test email** to check that it works.
- While it is on, the panel checks every two minutes and sends **one message** when new problems appear and one when they clear. It does not repeat itself while a problem stays. Muted services are not mailed.
- Works with any mail server that offers STARTTLS (port 587) or SSL (port 465); for Gmail and similar, use an app password.

### Security notes
- The connection **must be encrypted** and the server's certificate is checked; unencrypted mail is refused, so the password never crosses the network in the clear.
- The password is stored in its own file in the data folder (readable only by the panel account), is never sent back to the browser, and is never written to the audit log. Leave the field empty to keep the saved password.
- Addresses, server name and port are validated, so a crafted value cannot add extra mail headers or recipients.
- Saving the settings, test emails and failed sends are written to the audit log.
