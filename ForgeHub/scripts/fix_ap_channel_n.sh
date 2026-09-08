#!/bin/bash
set -u

echo "=== [1/5] Terminating all rogue/interfering processes ==="
# Kill old watchdog child of forgehub if alive
pkill -9 -f "watchdog.sh reset" 2>/dev/null || true
pkill -9 -f "wpa_supplicant.*wlan0" 2>/dev/null || true
pkill -9 -f "avahi-autoipd" 2>/dev/null || true
chmod -x /etc/network/if-up.d/avahi-autoipd 2>/dev/null || true
systemctl stop avahi-autoipd 2>/dev/null || true

echo "=== [2/5] Updating hostapd.conf for 802.11n & pure WPA2-CCMP ==="
cat > /etc/hostapd/hostapd.conf << 'EOF'
interface=wlan0
driver=nl80211
ssid=Forge-E10
hw_mode=g
channel=1
ieee80211n=1
wmm_enabled=1
ht_capab=[HT20][SHORT-GI-20]
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=forgehub
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
rsn_pairwise=CCMP
beacon_int=100
EOF

echo "=== [3/5] Starting forge-ap-ctrl ==="
/usr/local/bin/forge-ap-ctrl restart

echo "=== [4/5] Checking status ==="
sleep 2
/usr/local/bin/forge-ap-ctrl status
ip addr show wlan0

echo "=== [5/5] Checking dmesg for beaconing ==="
dmesg | grep -i rtw | tail -n 10
