# 📡 ForgeOS — Stack de Provisionamento (BTV E10)

Stack de provisionamento **testada e em produção** na BTV Express E10 (Amlogic S905X2, Armbian, kernel `6.18-ophub`).
Substitui os protótipos em [`legacy/`](legacy/) (forge-agent.py, captive-portal, forge_display.py).

## Arquitetura

```
┌─────────────────────────── BTV E10 / ForgeOS ───────────────────────────┐
│                                                                          │
│  forge-ap.service ──► bin/start-ap.sh                                    │
│    · driver 8189fs (power saving off)                                    │
│    · AP "RTL8189FTV_AP" via wpa_supplicant mode=2 (hostapd não funciona  │
│      neste driver)                                                       │
│    · dnsmasq: DHCP 192.168.4.10-250 + DNS cativo (wildcard → portal)     │
│    · iptables: :80 → :8080 + MASQUERADE se houver uplink                 │
│                                                                          │
│  forge-portal.service ──► web/server.py (:8080)                          │
│    · SPA Pico.css 100% offline (PSK + Enterprise/EAP eduroam)            │
│    · REST: GET /api/status · POST /api/provision · POST /api/reset       │
│    · KillMode=process (apply sobrevive ao stop do serviço)               │
│                                                                          │
│  forge-display.service ──► display/qr_screen.py (framebuffer HDMI)       │
│    · UI industrial dark (Inter + JetBrains Mono, 1920×1080)              │
│    · dual QR 220×220 + status pulsante; escrita em bloco único (sem      │
│      flicker); vtcon1 desbindado (forge-fbcon-disable.service)           │
│                                                                          │
│  forge-watchdog.service ──► bin/watchdog.sh                              │
│    · rollback: provisionamento travado >5min → AP                        │
│    · fallback: modo cliente sem internet >5min → AP                      │
│    · auto-limpeza de result.json obsoleto pós-boot                       │
│                                                                          │
│  Fluxo: POST /api/provision ─► bin/apply-client.sh                       │
│    network/build_client_conf.py (PSK | EAP) → testa associação, DHCP     │
│    e internet (-I wlan0) → sucesso mantém cliente / falha restaura AP    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Deploy

```bash
# na box (Armbian), com internet:
bash install.sh
```

O instalador é idempotente: garante dependências (`isc-dhcp-client`, `qrencode`,
`python3-pil`), copia stack, instala units systemd, neutraliza autostarts
conflitantes e valida o portal.

## Testes

```bash
bash tests/run_all.sh   # 16 unitários + 14 integração = 30 testes
```

- **Unitários**: gerador wpa_supplicant (PSK/hex/escape/EAP PEAP+TTLS), validação
  da API, render do display (1920×1080, bandas de pulso)
- **Integração** (na box): portal/DNS/AP no ar, rejeição 400, ciclo completo
  provision-inválido → rollback → portal reativado → reset

## Credenciais padrão

| Item | Valor | Onde mudar |
|---|---|---|
| SSID do AP | `RTL8189FTV_AP` | `network/wpa_ap.conf` + `display/qr_screen.py` |
| Senha do AP | `tvbox12345` | idem |
| Portal | `http://192.168.4.1` | `network/dnsmasq_portal.conf` |

> Alterar em `wpa_ap.conf` e `qr_screen.py` **juntos** (QR reflete o AP).

## Decisões de engenharia

- **wpa_supplicant mode=2** em vez de hostapd (driver RTL8189FTV não suporta AP via hostapd)
- **Render PIL pixel-perfeito** em vez de browser headless (device 2GB RAM)
- **Rádio único**: durante teste de conexão o AP sai do ar por ~90s — UI avisa e watchdog garante retorno
- **Socket stale**: `rm -f /var/run/wpa_supplicant-*/wlan0` antes de cada start (crash anterior deixa socket órfão)
- **`ping -I wlan0`**: teste de internet amarrado à interface correta (eth0 pode ter rota default)

## Legado

Protótipos da hackathon preservados em [`legacy/`](legacy/) — não utilizados pela
stack atual.
