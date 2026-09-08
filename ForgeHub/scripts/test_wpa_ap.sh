#!/bin/bash
set -u

echo "=== Clean AP test with wpa_supplicant mode=2 ==="

# 1. Stop everything
pkill -9 -f hostapd 2>/dev/null || true
pkill -9 -f wpa_supplicant 2>/dev/null || true
pkill -9 -f dnsmasq 2>/dev/null || true
pkill -9 -f avahi 2>/dev/null || true

# 2. Flush interface
ip link set wlan0 down 2>/dev/null || true
ip addr flush dev wlan0 2>/dev/null || true
sleep 1
ip link set wlan0 up
ip addr add 192.168.4.1/24 dev wlan0

# 3. Create clean wpa_supplicant mode=2 configuration
cat > /tmp/wpa_ap_clean.conf << 'EOF'
ctrl_interface=/var/run/wpa_supplicant
ap_scan=1

network={
    ssid="Forge-E10"
    mode=2
    frequency=2437
    key_mgmt=WPA-PSK
    proto=RSN
    pairwise=CCMP
    group=CCMP
    psk="forgehub"
}
EOF

# 4. Start wpa_supplicant mode=2
wpa_supplicant -B -i wlan0 -c /tmp/wpa_ap_clean.conf -P /run/forge-ap.pid
sleep 2

# 5. Start dnsmasq
dnsmasq -C /opt/forgeos/network/dnsmasq_portal.conf

# 6. Check state
iw dev wlan0 info
ip addr show wlan0
dmesg | grep -i rtw | tail -n 15
