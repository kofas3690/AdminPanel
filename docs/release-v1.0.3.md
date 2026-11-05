**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.3_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **The File manager no longer shows whether a Linux account exists.** A name that did not exist was turned away at once, while a real account took a moment longer to check, so the difference in time gave the name away. Both now go to the SSH server the same way and answer with the same message.

### Fixed
- **The File manager works when the account's login shell is not bash.** Commands such as copy, move, delete, folder size and free space were sent through the account's login shell with bash-style quoting. In `tcsh` a name containing `!` made them fail, and other shells can treat other characters differently. The commands are now sent as plain letters and digits and run by `/bin/sh`, so every login shell handles them the same way.
- **A file whose name contains a line break can be downloaded.** Before, the download failed because the line break ended up in the response header.
- **Opening a folder with a very large number of files no longer loads the whole folder at once.** The panel reads the listing as it arrives and stops after 100,000 entries (it still shows at most 5,000 and says the list is cut short).
