#!/bin/bash
set -euo pipefail

echo "=== [1/6] Cleaning up conflicting legacy services ==="
systemctl stop rtl8189_ap.service 2>/dev/null || true
systemctl disable rtl8189_ap.service 2>/dev/null || true
systemctl stop forge-display.service 2>/dev/null || true
systemctl disable forge-display.service 2>/dev/null || true
systemctl stop forge-ap.service 2>/dev/null || true
systemctl disable forge-ap.service 2>/dev/null || true

pkill -9 -f qr_screen.py 2>/dev/null || true
pkill -9 -f /opt/forgeos/bin/watchdog.sh 2>/dev/null || true
pkill -9 -f start_wifi_ap.sh 2>/dev/null || true
pkill -9 -f wpa_supplicant 2>/dev/null || true
pkill -9 -f hostapd 2>/dev/null || true
pkill -9 -f dnsmasq 2>/dev/null || true

echo "=== [2/6] Configuring hostapd.conf ==="
mkdir -p /etc/hostapd
cat > /etc/hostapd/hostapd.conf << 'EOF'
interface=wlan0
driver=nl80211
ssid=MultiForge-Setup-E10
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=forgehub
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

mkdir -p /etc/default
cat > /etc/default/hostapd << 'EOF'
DAEMON_CONF="/etc/hostapd/hostapd.conf"
EOF

echo "=== [3/6] Configuring dnsmasq captive portal ==="
mkdir -p /opt/forgeos/network
cat > /opt/forgeos/network/dnsmasq_portal.conf << 'EOF'
interface=wlan0
except-interface=lo
bind-interfaces

dhcp-range=192.168.4.10,192.168.4.250,255.255.255.0,12h
dhcp-option=3,192.168.4.1
dhcp-option=6,192.168.4.1
dhcp-authoritative

# Captive DNS
no-resolv
no-hosts
address=/#/192.168.4.1
EOF

echo "=== [4/6] Creating robust /usr/local/bin/forge-ap-ctrl ==="
cat > /usr/local/bin/forge-ap-ctrl << 'EOF'
#!/bin/bash
set -u

ACTION="${1:-start}"
IFACE="wlan0"
AP_IP="192.168.4.1"
CONF="/etc/hostapd/hostapd.conf"
DNS_CONF="/opt/forgeos/network/dnsmasq_portal.conf"
PID_FILE="/run/hostapd.pid"
DNS_PID="/run/forge-dnsmasq.pid"

start_ap() {
    echo "[forge-ap-ctrl] Starting AP MultiForge-Setup-E10..."
    
    # 1. Stop any competing supplicant or hostapd
    pkill -9 -f "wpa_supplicant.*wlan0" 2>/dev/null || true
    pkill -9 -f "hostapd.*$CONF" 2>/dev/null || true
    if [ -f "$DNS_PID" ]; then
        kill -9 "$(cat "$DNS_PID")" 2>/dev/null || true
        rm -f "$DNS_PID"
    fi
    pkill -f "dnsmasq.*$DNS_CONF" 2>/dev/null || true

    # 2. Configure interface
    ip link set "$IFACE" down 2>/dev/null || true
    ip addr flush dev "$IFACE" 2>/dev/null || true
    sleep 1
    ip link set "$IFACE" up
    ip addr add "$AP_IP/24" dev "$IFACE"

    # 3. Start hostapd in background
    hostapd -B -P "$PID_FILE" "$CONF"
    sleep 1

    # 4. Start captive dnsmasq
    dnsmasq -C "$DNS_CONF" -x "$DNS_PID"

    # 5. Routing & NAT
    sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true
    iptables -t nat -C PREROUTING -i "$IFACE" -p tcp --dport 80 -j DNAT --to-destination "$AP_IP:8080" 2>/dev/null || \
        iptables -t nat -A PREROUTING -i "$IFACE" -p tcp --dport 80 -j DNAT --to-destination "$AP_IP:8080"

    WAN_IF=$(ip route show default 2>/dev/null | awk '{print $5}' | head -n1)
    if [ -n "$WAN_IF" ] && [ "$WAN_IF" != "$IFACE" ]; then
        iptables -t nat -C POSTROUTING -o "$WAN_IF" -j MASQUERADE 2>/dev/null || \
            iptables -t nat -A POSTROUTING -o "$WAN_IF" -j MASQUERADE
        iptables -C FORWARD -i "$IFACE" -o "$WAN_IF" -j ACCEPT 2>/dev/null || \
            iptables -A FORWARD -i "$IFACE" -o "$WAN_IF" -j ACCEPT
        iptables -C FORWARD -i "$WAN_IF" -o "$IFACE" -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
            iptables -A FORWARD -i "$WAN_IF" -o "$IFACE" -m state --state RELATED,ESTABLISHED -j ACCEPT
    fi

    echo "[forge-ap-ctrl] AP MultiForge-Setup-E10 active on $AP_IP"
}

stop_ap() {
    echo "[forge-ap-ctrl] Stopping AP..."
    pkill -f "hostapd.*$CONF" 2>/dev/null || true
    pkill -f "dnsmasq.*$DNS_CONF" 2>/dev/null || true
    if [ -f "$DNS_PID" ]; then
        kill "$(cat "$DNS_PID")" 2>/dev/null || true
        rm -f "$DNS_PID"
    fi
    ip addr flush dev "$IFACE" 2>/dev/null || true
    echo "[forge-ap-ctrl] AP stopped."
}

status_ap() {
    iw dev "$IFACE" info 2>/dev/null || echo "Interface $IFACE down"
    if pgrep -f "hostapd.*$CONF" >/dev/null; then
        echo "hostapd: RUNNING"
    else
        echo "hostapd: STOPPED"
    fi
    if pgrep -f "dnsmasq.*$DNS_CONF" >/dev/null; then
        echo "dnsmasq: RUNNING"
    else
        echo "dnsmasq: STOPPED"
    fi
}

case "$ACTION" in
    start)
        start_ap
        ;;
    stop)
        stop_ap
        ;;
    restart)
        stop_ap
        sleep 1
        start_ap
        ;;
    status)
        status_ap
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
EOF
chmod +x /usr/local/bin/forge-ap-ctrl

echo "=== [5/6] Starting forge-ap-ctrl ==="
/usr/local/bin/forge-ap-ctrl restart

echo "=== [6/6] Verifying status ==="
/usr/local/bin/forge-ap-ctrl status
ip addr show wlan0
