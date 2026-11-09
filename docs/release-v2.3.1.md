**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.3.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept.

### Fixed
- **Login history** showed "The 'last' command is not installed" as an error and left the whole Sign-ins tab empty. Now the panel looks for `last` on the normal system paths, and when it is missing the *Signed in now* list still works and a note under *History* says how to install it (`sudo apt install util-linux-extra`, or `util-linux` on older Ubuntu). The *Failed attempts* tab never depended on it.
