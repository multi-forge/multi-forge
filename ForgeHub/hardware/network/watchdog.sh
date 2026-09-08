#!/bin/bash
set -u

INTERFACE="wlan0"
TIMEOUT_SECS=60
CHECK_INTERVAL=5
AP_IP="192.168.4.1"

# Handle manual reset
if [ "${1:-}" = "reset" ]; then
    echo "[watchdog] Manual reset requested. Restarting AP mode..."
    /usr/local/bin/forge-ap-ctrl restart
    exit 0
fi

check_client_connection() {
    # Check if interface has an assigned inet IP (other than AP IP)
    local ip
    ip=$(ip -4 addr show dev "$INTERFACE" 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -n1)
    if [ -z "$ip" ] || [ "$ip" = "$AP_IP" ]; then
        return 1
    fi

    # Check default gateway or ping
    local gw
    gw=$(ip route show default dev "$INTERFACE" 2>/dev/null | awk '/default/ {print $3}' | head -n 1)
    if [ -n "$gw" ]; then
        if ping -c 1 -W 2 "$gw" > /dev/null 2>&1; then
            return 0
        fi
    fi

    # Fallback ping check
    if ping -c 1 -W 2 1.1.1.1 > /dev/null 2>&1 || ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1; then
        return 0
    fi

    return 1
}

fail_count=0

while true; do
    # 1. If currently in AP mode, AP is active and healthy
    if iw dev "$INTERFACE" info 2>/dev/null | grep -q "type AP"; then
        fail_count=0
        sleep "$CHECK_INTERVAL"
        continue
    fi

    # 2. In client / managed mode, check connectivity
    if check_client_connection; then
        fail_count=0
    else
        fail_count=$((fail_count + CHECK_INTERVAL))
        echo "[watchdog] Client connection unverified ($fail_count/${TIMEOUT_SECS}s)..."
        if [ "$fail_count" -ge "$TIMEOUT_SECS" ]; then
            echo "[watchdog] Timeout reached ($TIMEOUT_SECS s). Restoring AP MultiForge-Setup-E10..."
            /usr/local/bin/forge-ap-ctrl start
            fail_count=0
        fi
    fi

    sleep "$CHECK_INTERVAL"
done
