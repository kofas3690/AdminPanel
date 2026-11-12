**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_4.4.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **SSH keys** (a tab in the *Accounts* group). Pick an account, see the public keys that let it sign in over SSH (type, SHA256 fingerprint, comment), **add** a key by pasting its public half, or **remove** one. This is the step before turning off SSH password sign-in, which the Security check recommends; its *SSH password sign-in* line now links here.

### Security note
- A new root helper, `adminpanel-sshkeys`, works on `~/.ssh/authorized_keys` **as that user**: it drops to the account's own user and group id first, so a link planted in the home folder cannot reach anything the user could not already reach (tested against a linked `.ssh` folder, a linked `authorized_keys` and a linked home folder). It accepts only accounts with a user id of 1000 or more and a real login shell, only plain one-line public keys of a known type with a valid key body (so no `command=` or other options can be added), and removes a key only by its fingerprint. Keys with options that are already in a file are never shown or changed. The remote-management account (Servers page) does **not** get these rules.
