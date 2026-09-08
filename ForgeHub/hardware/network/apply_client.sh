#!/bin/bash
set -u

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <ssid> <auth_type> [password] [identity]"
    exit 1
fi

SSID=$1
AUTH_TYPE=$2
CONF_FILE="/etc/wpa_supplicant/wpa_supplicant-wlan0.conf"

# 1. Cleanly stop AP mode
if [ -x "/usr/local/bin/forge-ap-ctrl" ]; then
    /usr/local/bin/forge-ap-ctrl stop 2>/dev/null || true
fi

# 2. Write client wpa_supplicant configuration
mkdir -p /etc/wpa_supplicant
cat > "$CONF_FILE" <<EOF
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US
EOF

if [ "$AUTH_TYPE" = "WPA2-PSK" ] || [ "$AUTH_TYPE" = "psk" ]; then
    PASS="${3:-}"
    wpa_passphrase "$SSID" "$PASS" >> "$CONF_FILE"
elif [ "$AUTH_TYPE" = "EAP-PEAP" ] || [ "$AUTH_TYPE" = "eap" ]; then
    PASS="${3:-}"
    IDENTITY="${4:-}"
    cat >> "$CONF_FILE" <<EOF
network={
    ssid="$SSID"
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="$IDENTITY"
    password="$PASS"
    phase2="auth=MSCHAPV2"
}
EOF
elif [ "$AUTH_TYPE" = "EAP-TTLS" ]; then
    PASS="${3:-}"
    IDENTITY="${4:-}"
    cat >> "$CONF_FILE" <<EOF
network={
    ssid="$SSID"
    key_mgmt=WPA-EAP
    eap=TTLS
    identity="$IDENTITY"
    password="$PASS"
    phase2="auth=MSCHAPV2"
}
EOF
elif [ "$AUTH_TYPE" = "EAP-TLS" ]; then
    IDENTITY="${3:-}"
    cat >> "$CONF_FILE" <<EOF
network={
    ssid="$SSID"
    key_mgmt=WPA-EAP
    eap=TLS
    identity="$IDENTITY"
    client_cert="/etc/ssl/certs/client.crt"
    private_key="/etc/ssl/private/client.key"
}
EOF
fi

# 3. Associate client
pkill -9 -f "wpa_supplicant.*wlan0" 2>/dev/null || true
ip link set wlan0 down 2>/dev/null || true
ip addr flush dev wlan0 2>/dev/null || true
sleep 1
ip link set wlan0 up 2>/dev/null || true
wpa_supplicant -B -i wlan0 -c "$CONF_FILE" -P /run/wpa_supplicant_client.pid

# 4. Request DHCP lease
dhclient -r wlan0 2>/dev/null || true
dhclient -1 -v wlan0 2>/dev/null || udhcpc -i wlan0 -n -q 2>/dev/null || true
EOF
