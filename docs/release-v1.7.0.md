**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.7.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Logs is now in the sidebar** (System, after Accounts). The journal viewer already existed but had no menu entry, so it could only be reached by typing `/logs.html`.

### Changed
- **The Logs page is rebuilt** to read like a log browser:
  - Newest entries first, grouped under a heading for each day, with a *Reboot* marker where the machine restarted.
  - **Priority** works as "X and above" (Only emergency … Debug and above), so choosing *Error and above* shows errors, critical, alert and emergency together. The default is *Info and above*.
  - **Identifier** drop-down lists every source that has written to the journal (`sshd-session`, `kernel`, `systemd`, …), so you no longer type unit names.
  - Search as you type, and a **Pause** / **Resume** button instead of the Follow checkbox. New entries arrive automatically unless paused.
  - Identical lines that follow each other are folded into one row with a count.
  - Warnings and errors have a warning icon; Download still saves what is shown.
- The journal API gains `ident` (filter by identifier) and `/api/journal/identifiers`. All input is validated as before.
