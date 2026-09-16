#!/bin/bash
# Receives a root-only profile path. Credentials must never be command arguments.
set -euo pipefail
CONF_FILE=/etc/wpa_supplicant/wpa_supplicant-wlan0.conf
AP_CTRL=/usr/local/bin/forge-ap-ctrl

if [ "${1:-}" = "--connect" ]; then
    profile=$2
    "$AP_CTRL" stop >/dev/null 2>&1
    pkill -f 'wpa_supplicant.*wlan0' 2>/dev/null || true
    ip addr flush dev wlan0
    ip link set wlan0 up
    install -m 600 "$profile" "$CONF_FILE"
    wpa_supplicant -B -i wlan0 -c "$CONF_FILE" -P /run/wpa_supplicant_client.pid >&2
    associated=0
    for ((i=0; i<15; i++)); do
        if wpa_cli -i wlan0 status 2>/dev/null | grep -q '^wpa_state=COMPLETED$'; then associated=1; break; fi
        sleep 2
    done
    [ "$associated" = 1 ] || exit 1
    if command -v dhclient >/dev/null; then
        timeout 20 dhclient -1 -q wlan0 >&2
    else
        timeout 20 udhcpc -i wlan0 -n -q -t 5 >&2
    fi
    client_ip=$(ip -4 -o addr show dev wlan0 scope global | awk '{split($4,a,"/"); print a[1]; exit}')
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
        pkill -f 'wpa_supplicant.*wlan0' 2>/dev/null || true
        if [ -f "$backup" ]; then install -m 600 "$backup" "$CONF_FILE"; else rm -f "$CONF_FILE"; fi
        "$AP_CTRL" restart >/dev/null 2>&1 || true
    fi
    rm -f "$backup"
}
trap rollback EXIT
# Bound association + DHCP, then restore AP on failure. No internet probe required.
timeout --kill-after=3 55 bash "$0" --connect "$profile"
