# 📡 ForgeOS — Stack de Provisionamento On-Device & Module Hub

Stack de provisionamento e runtime de borda **testada e em produção** na **BTV Express E10** (SoC Amlogic S905X2, 2GB LPDDR4, 8GB eMMC, Wi-Fi Realtek RTL8189FTV, Armbian Linux com kernel `6.18.44-ophub`).
Substitui os protótipos em [`legacy/`](legacy/) (forge-agent.py, captive-portal, forge_display.py).

## Arquitetura Geral

```text
┌─────────────────────────────────── BTV E10 / ForgeOS ───────────────────────────────────┐
│                                                                                         │
│  forge-ap.service ──────────► bin/start-ap.sh                                           │
│    · Driver 8189fs com economia de energia desativada                                   │
│    · AP "RTL8189FTV_AP" via wpa_supplicant mode=2 (canal 6, 2437 MHz)                   │
│    · dnsmasq: DHCP (192.168.4.10–250) + DNS cativo (wildcard *.local → 192.168.4.1)     │
│    · iptables: redirecionamento porta 80 → 8080 + MASQUERADE                            │
│                                                                                         │
│  forge-portal.service ──────► web/server.py (:8080)                                     │
│    · Servidor HTTP multithread Python 3 com suporte SPA SvelteKit                       │
│    · ESP32-SvelteKit REST API compatível (/rest/*)                                      │
│    · MultiForge Module Hub (/rest/modules, /api/modules/*)                              │
│    · UI Dark/Light industrial com Scanner Wi-Fi dBm e suporte Eduroam/802.1X EAP        │
│                                                                                         │
│  forge-display.service ─────► display/qr_screen.py (/dev/fb0)                           │
│    · Renderizador HDMI 1080p pixel-perfect via Pillow (sem browser/X11)                 │
│    · Dual QR Code (Conexão Wi-Fi automática + URL do Portal) + telemetria em tempo real │
│    · Escrita em framebuffer com double-buffering para zero flicker                      │
│                                                                                         │
│  forge-watchdog.service ────► bin/watchdog.sh                                           │
│    · Rollback: se provisionamento travar >75s → restaura AP automaticamente             │
│    · Fallback: se conexão cair ou ficar sem internet >5min → reativa AP                 │
│    · Limpeza de sockets órfãos e arquivos de lock na inicialização                      │
│                                                                                         │
│  Fluxo de Aplicação ────────► bin/apply-client.sh                                        │
│    · Constrói wpa_supplicant.conf (PSK ou EAP) via network/build_client_conf.py         │
│    · Testa associação, concessão DHCP e rota com ping -I wlan0                          │
│    · Sucesso: fixa conexão cliente / Falha: reverte para AP sem travar o dispositivo     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 🌐 Portal Web & API REST (`web/server.py` v2.1)

O servidor opera na porta `:8080` e atua tanto como Portal Cativo quanto como Central de Módulos (Module Hub).

### Endpoints REST Disponíveis

#### 1. Compatibilidade ESP32-SvelteKit
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/rest/features` | Flags de recursos ativos (wifi, ntp, security, etc.) |
| `GET` | `/rest/systemStatus` | Telemetria de CPU, RAM (total/livre/heap), uptime e cores |
| `GET` | `/rest/wifiStatus` | Status da interface Wi-Fi (IP, SSID, MAC, RSSI, canal) |
| `GET` | `/rest/ethernetStatus`| Status da interface cabeada eth0 (IP, MAC, link) |
| `GET` | `/rest/apStatus` | Configuração ativa do Ponto de Acesso (SSID, canal, clientes) |
| `GET` | `/rest/wifiScan` | Varredura de redes sem fio no formato ESP32 |

#### 2. MultiForge Module Hub
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/rest/modules` | Catálogo completo de módulos cadastrados no `ForgeDB` |
| `GET` | `/rest/modules/<id>` | Detalhes, requisitos e variantes do módulo |
| `POST`| `/api/modules/<id>/install` | Marca módulo como instalado no estado do ForgeOS |
| `POST`| `/api/modules/<id>/start` | Inicia o serviço do módulo via systemd |
| `POST`| `/api/modules/<id>/stop` | Pausa a execução do módulo |
| `POST`| `/api/modules/<id>/uninstall` | Remove o módulo e limpa seu estado |

#### 3. Provisionamento de Rede
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/status` | Estado geral do ForgeOS (`ap_active`, `provisioning`, `client_connected`) |
| `GET` | `/api/scan` | Varredura detalhada de redes (SSID, BSSID, RSSI, canal, encriptação) |
| `GET` | `/api/ap` | Parâmetros configuráveis do AP |
| `POST`| `/api/provision` | Submete credenciais Wi-Fi (WPA-PSK ou WPA2-Enterprise 802.1X) |
| `POST`| `/api/ap` | Atualiza SSID, canal ou senha do AP |
| `POST`| `/api/reset` | Força restauração imediata do modo AP |

---

## 🎨 Interface Web (SPA Industrial)

A interface em `web/index.html` foi reconstruída com foco em eficiência, design industrial escuro e operação 100% offline:

- **Modo Escuro & Claro:** Alternador com persistência local (`localStorage`) e paleta de alto contraste.
- **Scanner Wi-Fi em Tempo Real:** Radar com medidor de sinal dBm, badges de segurança (WPA, WPA2, WPA3, Open, Enterprise) e filtro de redes.
- **Modal de Conexão Dual-Mode:**
  - *Rede Doméstica (WPA-PSK):* Senha padrão (8–63 caracteres).
  - *Rede Corporativa / Acadêmica (802.1X EAP):* Suporte a Eduroam com métodos `PEAP`, `TTLS`, `PWD`, `TLS` e fase 2 `MSCHAPV2`, `PAP`, `GTC`.
- **Module Hub Dinâmico:** Visualização em cards de aplicações disponíveis no `ForgeDB` (ex: Assistente Mina, Web Scraping) com controle de ciclo de vida.
- **Console de Logs:** Terminal integrado para acompanhamento ao vivo de eventos do sistema e do provisionamento.

---

## 📺 Kiosk HDMI Framebuffer (`display/qr_screen.py`)

Em quiosques e instalações onde a TV Box está conectada a um monitor/TV via HDMI:
- Renderiza diretamente no framebuffer `/dev/fb0` em **1920×1080** (Full HD).
- Utiliza **double-buffering** em memória e grava o bloco de pixels de uma só vez, eliminando linhas de varredura ou cintilação (*flicker*).
- Exibe **Dual QR Code**:
  1. *QR de Wi-Fi (`WIFI:S:...`):* O smartphone escaneia e conecta à rede do AP sem digitar senha.
  2. *QR do Portal (`http://192.168.4.1:8080`):* Abre diretamente a tela de configuração no navegador.
- Mostra indicadores de telemetria: endereço IP, MAC, carga de CPU, RAM livre e status de conexão.

---

## 🛡️ Resiliência & Watchdog (`bin/watchdog.sh`)

O hardware possui desafios críticos de estabilidade que são mitigados pelo watchdog:

1. **Rádio Único RTL8189FTV:** O rádio não suporta AP + STA simultâneos. Ao iniciar o provisionamento, o AP é pausado por ~75 segundos enquanto o cliente tenta DHCP e rota. Se a rede não responder, o watchdog restaura o AP automaticamente.
2. **Sockets Órfãos:** Limpa `/var/run/wpa_supplicant-*/wlan0` na inicialização para evitar que processos anteriores travem o driver.
3. **Teste de Conectividade com Interface Fixa:** O script de verificação executa `ping -I wlan0 -c 1 1.1.1.1` para garantir que o tráfego está de fato fluindo pela interface sem fio e não pela porta Ethernet.

---

## 🚀 Instalação & Deploy

```bash
# na box (Armbian), com internet:
cd /opt/multi-forge/ForgeOS
bash install.sh
```

O instalador é idempotente: garante dependências (`isc-dhcp-client`, `qrencode`, `python3-pil`, `python3-yaml`, `dnsmasq`), copia stack, instala units systemd, neutraliza autostarts conflitantes e valida o portal.

---

## 🧪 Suíte de Testes

```bash
# Executar todos os testes unitários (cross-platform Windows/Linux):
python -m unittest discover -s tests -p "test_*.py" -v

# Executar suíte completa na TV Box (16 unitários + 14 integração = 30 testes):
bash tests/run_all.sh
```

- **Unitários**: gerador wpa_supplicant (PSK/hex/escape/EAP PEAP+TTLS), validação da API, render do display (1920×1080, bandas de pulso)
- **Integração** (na box): portal/DNS/AP no ar, rejeição 400, ciclo completo provision-inválido → rollback → portal reativado → reset

---

## 🔑 Credenciais e Parâmetros Padrão

| Item | Valor | Onde mudar |
|---|---|---|
| SSID do AP | `RTL8189FTV_AP` | `network/wpa_ap.conf` + `display/qr_screen.py` |
| Senha do AP | `tvbox12345` | `network/wpa_ap.conf` + `display/qr_screen.py` |
| Portal | `http://192.168.4.1:8080` | `network/dnsmasq_portal.conf` |

> Alterar em `wpa_ap.conf` e `qr_screen.py` **juntos** (QR reflete o AP).

---

## 🏛️ Decisões de Engenharia

- **wpa_supplicant mode=2** em vez de hostapd (driver RTL8189FTV não suporta AP via hostapd).
- **Render PIL pixel-perfeito** em vez de browser headless (economiza 500MB+ de RAM no device de 2GB).
- **Rádio único**: durante teste de conexão o AP sai do ar por ~75s — UI avisa e watchdog garante retorno.
- **Socket stale**: `rm -f /var/run/wpa_supplicant-*/wlan0` antes de cada start (crash anterior deixa socket órfão).
- **`ping -I wlan0`**: teste de internet amarrado à interface correta (eth0 pode ter rota default).

---

## 📜 Legado

Protótipos da hackathon preservados em [`legacy/`](legacy/) — não utilizados pela stack atual.
