#!/bin/bash
# Install the RTL8189FTV wpa_supplicant AP stack without replacing saved credentials.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root" >&2; exit 1; }
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
HUB_DIR=$(dirname "$SCRIPT_DIR")
for command in python3 wpa_supplicant wpa_cli dnsmasq ip iw iptables; do
    command -v "$command" >/dev/null || { echo "Missing dependency: $command" >&2; exit 1; }
done
# Generate missing configuration before touching the running radio.
python3 - <<'PY'
from pathlib import Path
import os, secrets, hashlib
root = Path('/opt/forgeos/network')
root.mkdir(parents=True, exist_ok=True)
ap = root / 'wpa_ap.conf'
if not ap.exists():
    ssid = os.environ.get('AP_SSID', 'MultiForge-Setup-E10')
    password = os.environ.get('AP_PASSWORD') or secrets.token_hex(8)
    if not 1 <= len(ssid.encode()) <= 32 or any(ord(c) < 32 for c in ssid):
        raise SystemExit('Invalid AP_SSID')
    if not 8 <= len(password.encode()) <= 63:
        raise SystemExit('AP_PASSWORD must contain 8-63 bytes')
    psk = hashlib.pbkdf2_hmac('sha1', password.encode(), ssid.encode(), 4096, 32).hex()
    config = ('ctrl_interface=/var/run/wpa_supplicant-ap\nap_scan=1\nnetwork={\n'
              + '    ssid=' + ssid.encode().hex() + '\n    mode=2\n    key_mgmt=WPA-PSK\n'
              + '    psk=' + psk + '\n    frequency=2437\n}\n')
    fd = os.open(ap, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(config)
    credential = root / 'ap-password.txt'
    fd = os.open(credential, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(password + '\n')
    print('AP password saved to /opt/forgeos/network/ap-password.txt (root only)')
dns = root / 'dnsmasq_portal.conf'
if not dns.exists():
    config = ('interface=wlan0\nexcept-interface=lo\nbind-interfaces\n'
              'dhcp-range=192.168.4.10,192.168.4.250,255.255.255.0,12h\n'
              'dhcp-option=3,192.168.4.1\ndhcp-option=6,192.168.4.1\n'
              'dhcp-authoritative\nno-resolv\nno-hosts\naddress=/#/192.168.4.1\n')
    fd = os.open(dns, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f: f.write(config)
PY
dnsmasq --test -C /opt/forgeos/network/dnsmasq_portal.conf
install -m 755 "$HUB_DIR/hardware/network/forge-ap-ctrl" /usr/local/bin/forge-ap-ctrl
watchdog_active=0
if systemctl is-active --quiet forge-watchdog; then
    watchdog_active=1
    systemctl stop forge-watchdog
fi
restore_watchdog() {
    if [ "$watchdog_active" = 1 ]; then systemctl start forge-watchdog; fi
}
trap restore_watchdog EXIT
/usr/local/bin/forge-ap-ctrl restart
/usr/local/bin/forge-ap-ctrl status
