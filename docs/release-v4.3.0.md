**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.3.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Security check** (a tab beside *Users*, *Login history*, *Groups* and *Sudo activity*). Runs nine common safety checks and lists each as **OK**, **Warning** or **Fix**, with a sentence on what is wrong and a link to the page where you can fix it: SSH sign-in as root, SSH password sign-in, the firewall, automatic security updates, a pending restart, fail2ban, accounts with an empty password, other accounts with root power, and clock synchronisation. Problems are listed first, and **Check again** reruns it.

### Security note
- Read only. A new root helper, `adminpanel-audit`, takes no input, changes nothing and returns only a yes or no and a sentence for each check; it never returns a password hash or file contents. It needs root only to read the SSH server settings and the password file. The remote-management account (Servers page) does **not** get this rule.
