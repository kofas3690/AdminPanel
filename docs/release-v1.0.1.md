**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Fixed
- **A wrong password in the File manager no longer sends you back to the main panel login.** The server answered "wrong password" with the same code it uses for "your panel session has ended", so the browser logged you out of the page. A wrong Linux password now stays on the File manager sign-in card and shows an error. The main panel login only appears when your panel session really ended.

### Changed
- **Three tries, then a 30-second wait.** After 3 wrong passwords in a row the File manager sign-in form pauses for 30 seconds. The Connect button counts the seconds down and nothing is sent to the SSH server while you wait (not even a correct password). Each wrong password shows how many tries are left. A correct password resets the count, and the same wait applies to the SSH-key form.
- The existing limit still applies on top: 5 failed sign-ins in 5 minutes (per browser address and panel user), and 10 in 5 minutes per Linux account, lock sign-in for a few minutes. So after the first 3 wrong passwords and the wait, 2 more wrong ones reach that lock.
