**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_0.9.9_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Limit password sign-in over SSH to one group (optional).** `adminpanel-setup` allows password sign-in over SSH from this machine only, so the Terminal and File manager can work. By default that applies to every account. You can now limit it to the members of one group:

  ```bash
  sudo adminpanel-setup ssh-restrict adminpanel-ssh     # creates the group if it does not exist
  sudo usermod -aG adminpanel-ssh YOURNAME              # add each account that needs the Terminal / File manager
  ```

  Accounts that are not in the group can then no longer sign in to the Terminal or File manager. To go back to "every account", run `sudo adminpanel-setup ssh-restrict off`. The change is checked with `sshd -t` before it is applied and is undone automatically if the SSH server rejects it. Nothing changes unless you run this command, and running `adminpanel-setup` again does not undo it.

### Changed
- **Terminal and File manager accept more Linux account names.** Names with capital letters and dots (for example `john.doe`) now work. A name still has to start with a letter or `_`, so it can never be read as an SSH option.

### Known limitations
- Any panel administrator can still try any non-root account in the Terminal; the account's password is the only gate. With the group limit above, only group members can sign in.
