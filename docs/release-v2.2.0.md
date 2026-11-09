**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.2.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Groups** (under *Accounts*, next to *Users* and *Login history*). See every group with its members, create a group, add an ordinary user to it, remove a user from it, and delete an empty group.
- **Locked on purpose.** Groups that give control of the machine (`sudo`, `adm`, `docker`, `shadow` and similar), system groups (group number below 1000) and administrator accounts cannot be changed from the panel; they show as *manage from console*. A user's main group cannot be removed.
- Every change is written to the audit log (user, group, who did it).

### Security note
- The accounts helper gets four new commands (`mkgroup`, `rmgroup`, `addgroup`, `delgroup`) and a list command (`groups`), each with its own exact sudo rule. The helper checks every name again as root, so a forged request cannot touch a privileged group or an administrator.
