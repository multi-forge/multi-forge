#!/usr/bin/env bash
# Eduroam Probe — UNESP Sorocaba
LOG_FILE="/var/log/eduroam-probe.status"
echo "[eduroam-probe] Iniciando monitoramento da rede acadêmica..."
while true; do
    DATE=$(date -Iseconds)
    PING_RES=$(ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 && echo "OK" || echo "FAIL")
    DNS_RES=$(host unesp.br >/dev/null 2>&1 && echo "OK" || echo "FAIL")
    echo "$DATE | Ping: $PING_RES | DNS: $DNS_RES | Rede: ICTS-Sorocaba" | tee "$LOG_FILE"
    sleep 30
done
