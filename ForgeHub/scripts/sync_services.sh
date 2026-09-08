#!/bin/bash
set -euo pipefail

chmod +x /opt/forgehub/hardware/network/watchdog.sh
chmod +x /opt/forgehub/hardware/network/apply_client.sh
chmod +x /opt/forgehub/hardware/display/forge_kiosk.py

# Replace legacy scripts with wrappers to forge-ap-ctrl
mkdir -p /opt/forgeos/bin
cat > /opt/forgeos/bin/start-ap.sh << 'EOF'
#!/bin/bash
exec /usr/local/bin/forge-ap-ctrl start
EOF
chmod +x /opt/forgeos/bin/start-ap.sh

cat > /usr/local/bin/start_wifi_ap.sh << 'EOF'
#!/bin/bash
exec /usr/local/bin/forge-ap-ctrl start
EOF
chmod +x /usr/local/bin/start_wifi_ap.sh

# Ensure hostapd is enabled in systemd or managed
systemctl daemon-reload

# Restart forge-watchdog and forge-kiosk
systemctl restart forge-watchdog.service
systemctl restart forge-kiosk.service

echo "Services restarted successfully."
EOF
