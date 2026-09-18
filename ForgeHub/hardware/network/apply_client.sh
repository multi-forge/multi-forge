#!/bin/bash
# Receives a root-only profile path. Credentials must never be command arguments.
set -euo pipefail
IFACE="${WIFI_IFACE:-wlan0}"
CONF_FILE="/etc/wpa_supplicant/wpa_supplicant-${IFACE}.conf"
AP_CTRL=/usr/local/bin/forge-ap-ctrl

if [ "${1:-}" = "--connect" ]; then
    profile=$2
    "$AP_CTRL" stop >/dev/null 2>&1 || true
    # A previous unclean termination leaves a stale control socket that
    # blocks any new supplicant on this interface. Safe to drop: no
    # supplicant is running here yet (killed below if it were).
    rm -f "/var/run/wpa_supplicant/${IFACE}" "/run/wpa_supplicant/${IFACE}"
    pkill -f "wpa_supplicant.*${IFACE}" 2>/dev/null || true
    # NetworkManager would fight a foreign supplicant for the radio:
    # hand the interface over for the duration of the client session.
    if command -v nmcli >/dev/null 2>&1; then
        nmcli device set "$IFACE" managed no >/dev/null 2>&1 || true
    fi
    ip addr flush dev "$IFACE"
    ip link set "$IFACE" up
    install -m 600 "$profile" "$CONF_FILE"
    wpa_supplicant -B -i "$IFACE" -c "$CONF_FILE" -P /run/wpa_supplicant_client.pid >&2
    associated=0
    for ((i=0; i<15; i++)); do
        if wpa_cli -i "$IFACE" status 2>/dev/null | grep -q '^wpa_state=COMPLETED$'; then associated=1; break; fi
        sleep 2
    done
    [ "$associated" = 1 ] || exit 1
    if command -v dhclient >/dev/null; then
        timeout 20 dhclient -1 -q "$IFACE" >&2
    else
        timeout 20 udhcpc -i "$IFACE" -n -q -t 5 >&2
    fi
    client_ip=$(ip -4 -o addr show dev "$IFACE" scope global | awk '{split($4,a,"/"); print a[1]; exit}')
    [ -n "$client_ip" ] && [ "$client_ip" != 192.168.4.1 ] || exit 1
    printf '%s\n' "$client_ip"
    exit 0
fi

[ "$#" = 1 ] && [ -f "$1" ] && [ -x "$AP_CTRL" ] || exit 1
profile=$1
backup="$(dirname "$profile")/previous.conf"
mkdir -p /etc/wpa_supplicant
if [ -f "$CONF_FILE" ]; then cp -p "$CONF_FILE" "$backup"; fi
rollback() {
    result=$?
    if [ "$result" != 0 ]; then
        pkill -f "wpa_supplicant.*${IFACE}" 2>/dev/null || true
        rm -f "/var/run/wpa_supplicant/${IFACE}" "/run/wpa_supplicant/${IFACE}"
        if [ -f "$backup" ]; then install -m 600 "$backup" "$CONF_FILE"; else rm -f "$CONF_FILE"; fi
        if command -v nmcli >/dev/null 2>&1; then
            nmcli device set "$IFACE" managed yes >/dev/null 2>&1 || true
        fi
        "$AP_CTRL" restart >/dev/null 2>&1 || true
    fi
    rm -f "$backup"
}
trap rollback EXIT
# Bound association + DHCP, then restore AP on failure. No internet probe required.
timeout --kill-after=3 55 bash "$0" --connect "$profile"
