**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_2.5.1_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept.

### Improved
- **Clearer errors when a remote server can't be reached** (Servers → Remote services, remote reboot, logs). The panel used to say "Could not sign in to that server" for many different problems. It now says what happened: the server refused the panel's key, accepted the connection but didn't answer in time, refused the connection (SSH not running or wrong port), reset or closed the connection, or didn't answer at all (busy, starting up, or a firewall dropping it). Nothing about how the panel connects or what it is allowed to do has changed.
