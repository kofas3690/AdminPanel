**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.2.2_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

**Before you upgrade:** every panel administrator now needs two-step verification. Check with `sudo adminpanel-selfcheck` after upgrading; if it lists an account, run `sudo adminpanel-setup 2fa` on the server (SSH still works, so you cannot be locked out of the machine).

### Security
- **Two-step verification is required to sign in.** An account without it is refused with a message that says what to run. A wrong password still counts as a failed attempt; a right password on an account without 2FA does not.
- **Admin passwords must contain at least one symbol** (for example `!`, `@`, `#`, `-`, `_`). The minimum length stays at 8. This applies when you create an administrator or reset a password; existing passwords keep working.
- **Per-account sign-in limit.** Besides the existing 5 failures per address and user in 5 minutes, an account is now paused after 20 wrong attempts from all addresses together, so guessing from many addresses at once no longer gets unlimited tries.
- **Stricter service settings.** The panel's systemd unit now also blocks kernel module loading, kernel log access, cgroup and clock changes, hostname changes, new namespaces and non-native system calls, and creates files private to the panel by default.
- `adminpanel-selfcheck` reports any administrator without two-step verification.

### Emergency switch
If you ever lose the authenticator and the recovery codes, run `sudo adminpanel-setup 2fa` on the server. As a last resort, set `Environment=ADMINPANEL_ALLOW_NO_2FA=1` in a drop-in for `adminpanel.service`; remove it again afterwards.
