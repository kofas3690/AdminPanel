**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_1.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Security
- **A successful File manager sign-in no longer resets the failed-sign-in counter.** The counter is shared with the Terminal, so someone with a panel session and one account they knew the password for could wipe it between guesses at another account. Failures now stay counted until their 5-minute window ends.
- **A burst of simultaneous guesses can no longer get past the limit.** The File manager now counts an attempt before it tries the password (and gives it back if the password turns out to be right, or the SSH server could not be reached), so 30 requests sent at once get at most 5 guesses, not 30.
- **The File manager now uses the per-account limit too.** 10 failures in 5 minutes against one Linux account lock it for the File manager as well as the Terminal, from any browser address.
- **Simultaneous File manager sign-ins can no longer exceed the connection limits** (3 accounts per browser session, 8 in total). Sign-ins still in progress now count towards the limits.
- **Free disk space in a folder is now read as the signed-in account**, not by the panel itself, so it can no longer reveal the free space of folders that account cannot open.

### Fixed
- **File manager sign-in accepts account names with capital letters and dots** (for example `john.doe`). Release 0.9.9 said it did, but the sign-in form still used the old lowercase-only rule. The Terminal was not affected.
- **Saving a file you opened through a symbolic link no longer replaces the link with a regular file.** The editor now writes to the file the link points to and leaves the link alone.
- **Saving a file keeps its owner.** When saving through a temporary file would give the file a different owner, the editor writes the file in place instead.

### Known limitations
- Saving through a temporary file (used when the folder is writable and the owner stays the same) does not carry over extended attributes or ACLs.
- A file whose name contains a line break cannot be downloaded: the server refuses the header and the download fails. It is not a security problem.
