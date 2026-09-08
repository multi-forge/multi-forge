#!/bin/bash
set -u

echo "=== [1/4] Writing standard wpa_ap.conf ==="
mkdir -p /opt/forgeos/network
cat > /opt/forgeos/network/wpa_ap.conf << 'EOF'
ctrl_interface=/var/run/wpa_supplicant
ap_scan=1

network={
    ssid="Forge-E10"
    mode=2
    frequency=2412
    key_mgmt=WPA-PSK
    proto=RSN
    pairwise=CCMP
    group=CCMP
    psk="forgehub"
}
EOF

mkdir -p /etc/wpa_supplicant
cp /opt/forgeos/network/wpa_ap.conf /etc/wpa_supplicant/wpa_supplicant-ap.conf

echo "=== [2/4] Updating /usr/local/bin/forge-ap-ctrl ==="
cat > /usr/local/bin/forge-ap-ctrl << 'EOF'
#!/bin/bash
set -u

ACTION="${1:-start}"
IFACE="wlan0"
AP_IP="192.168.4.1"
CONF="/opt/forgeos/network/wpa_ap.conf"
DNS_CONF="/opt/forgeos/network/dnsmasq_portal.conf"
PID_FILE="/run/forge-ap.pid"
DNS_PID="/run/forge-dnsmasq.pid"

start_ap() {
    echo "[forge-ap-ctrl] Starting AP Forge-E10..."
    
    # 1. Stop any competing supplicants, hostapd, or dnsmasq
    pkill -9 -f "hostapd" 2>/dev/null || true
    pkill -9 -f "wpa_supplicant.*$IFACE" 2>/dev/null || true
    pkill -9 -f "avahi-autoipd" 2>/dev/null || true
    if [ -f "$DNS_PID" ]; then
        kill -9 "$(cat "$DNS_PID")" 2>/dev/null || true
        rm -f "$DNS_PID"
    fi
    pkill -f "dnsmasq.*$DNS_CONF" 2>/dev/null || true

    # 2. Reset interface
    ip link set "$IFACE" down 2>/dev/null || true
    ip addr flush dev "$IFACE" 2>/dev/null || true
    sleep 1
    ip link set "$IFACE" up
    ip addr add "$AP_IP/24" dev "$IFACE"

    # 3. Start wpa_supplicant mode=2
    wpa_supplicant -B -i "$IFACE" -c "$CONF" -P "$PID_FILE"
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
        iptables -C FORWARD -i "$WAN_IF" -o "$IFACE" -m state --state RELATED,ESTABLISHED 2>/dev/null || \
            iptables -A FORWARD -i "$WAN_IF" -o "$IFACE" -m state --state RELATED,ESTABLISHED
    fi

    echo "[forge-ap-ctrl] AP Forge-E10 active on $AP_IP"
}

stop_ap() {
    echo "[forge-ap-ctrl] Stopping AP..."
    pkill -f "wpa_supplicant.*$CONF" 2>/dev/null || true
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
    if pgrep -f "wpa_supplicant.*$CONF" >/dev/null; then
        echo "wpa_supplicant AP: RUNNING"
    else
        echo "wpa_supplicant AP: STOPPED"
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

echo "=== [3/4] Ensuring watchdog uses forge-ap-ctrl ==="
systemctl restart forge-watchdog.service

echo "=== [4/4] Verifying status ==="
/usr/local/bin/forge-ap-ctrl status
ip addr show wlan0
