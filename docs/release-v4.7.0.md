**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.7.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Certificate renewal** (a tab on the *Certificates* page, next to *Certificates*). Lists the Let's Encrypt certificates certbot manages (name, the domains, expiry and days left), says whether the renewal timer is on, and has two buttons: **Test renewal (dry run)**, which changes nothing and shows whether renewal would work, and **Renew now**, which renews only the certificates certbot considers due (within 30 days of expiry), so pressing it early is harmless. The output of certbot is shown on the page. After a renewal, reload nginx on the Websites page. If certbot is not installed the page says so and how to install it.

### Security note
- A new root helper, `adminpanel-certbot`, accepts only `status`, `test`, `renew` and `check`, with exact sudo rules, and runs fixed certbot command lines: no domain, path or option from the caller reaches certbot. It never reads a private key. The remote-management account (Servers page) does **not** get these rules.
