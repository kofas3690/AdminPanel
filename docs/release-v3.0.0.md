**Install**

```bash
sudo apt update
sudo apt install ./adminpanel_3.0.0_all.deb
sudo adminpanel-selfcheck
```

Your accounts, certificate, port and settings are kept. Full guide: [docs/INSTALL.md](https://github.com/kofas3690/AdminPanel/blob/main/docs/INSTALL.md).

### Added
- **Kernel** (a tab beside *Hardware*). Shows the running kernel, whether it is *tainted* (with each reason in words, such as an out-of-tree or proprietary module), and every loaded module with its size and what uses it, with a filter box.
- **Security settings.** A short table of kernel settings that matter on a server (address-space randomisation, kernel pointer and log restrictions, symlink and hard-link protection, SYN cookies, reverse-path filtering, redirects and others), each marked *As recommended*, *Different* (with the suggested value) or *Info* where the right value depends on the machine's job, such as IP forwarding.

### Notes
- Read only, with no new root helper and no sudo rule: everything comes from `/proc`, which any account can read. Nothing here changes a setting.
- A setting marked *Different* is a prompt to check, not proof of a problem.
