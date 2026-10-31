# Admin panel

    sudo adminpanel-setup        # first run: certificate, web server, administrator, two-step verification
    sudo adminpanel-selfcheck    # verify an installation

The panel listens on https://THIS-MACHINE:8443 (change with: sudo adminpanel-setup tls --port N).
Open that port in your firewall (ufw allow 8443/tcp). The certificate is self-signed.

The Terminal and File manager sign in to Linux accounts over SSH from this machine, so the SSH server must
be running and the account needs a password (sudo passwd NAME). On cloud images, run: sudo adminpanel-setup ssh-local

Removing the package keeps your data. Purging deletes the panel's files and account, but leaves settings it made
for this machine (network files, /etc/fstab and /etc/crypttab lines marked "adminpanel", RAID and VPN data).

Install only on machines you control: the panel can change disks, networking and accounts through root helpers.
