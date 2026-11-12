**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.8.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Blocked addresses** (a tab beside *Firewall*). Shows the fail2ban jails on the machine, how many failures and blocks each has seen, its settings (failures allowed, time window, block length) and the addresses it is blocking right now. **Lift** removes one block, which helps if you locked yourself out with wrong passwords. If fail2ban is not installed, or its service is stopped, the page says so and what to do (install `fail2ban` on the Packages page, or start the `fail2ban` service).

### Security note
- A new root helper, `adminpanel-f2b`, allows only `list` and `unban`, with exact sudo rules. It cannot block an address, change a jail or edit any fail2ban setting. The jail must be one fail2ban itself lists and the address must be a valid IPv4 or IPv6 address.
- Lifting a block is written to the audit log. The remote-management account (Servers page) does **not** get these rules.
