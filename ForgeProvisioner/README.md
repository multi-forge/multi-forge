# ForgeProvisioner

Pilha oficial de provisionamento on-device, interface cativa Wi-Fi, kiosk HDMI e branding para dispositivos **MultiForge**.

---

## 🚀 Visão Geral

O **ForgeProvisioner** gerencia o ciclo de vida inicial, configuração de rede e telemetria local no hardware embarcado:

1. **Ponto de Acesso Autônomo:** Inicialização direta de AP Wi-Fi WPA2 (`ForgeOS-Setup-XXXX`) em `192.168.4.1` sem depender de NetworkManager.
2. **Portal Cativo REST (Porta 8080):** Servidor HTTP leve em Python 3 com interface web SPA responsiva (Dark/Light), suporte a redes WPA-Personal e WPA-Enterprise (802.1X), zero dependências externas pesadas.
3. **Kiosk HDMI Engine v3.0 (`/dev/fb0`):** Renderizador gráfico direto no framebuffer com transições anti-flicker, QR Code dinâmico para conexão Wi-Fi com 1 toque, monitoramento de conectividade L2 e feedback visual em tempo real.
4. **Watchdog de Conectividade:** Monitoramento contínuo de rota e gateway com reversão automática segura para modo AP caso ocorra falha de associação.
5. **Identidade Visual & Branding:** Banner dinâmico Neofetch-style para login SSH (`forge-banner`), `/etc/issue` e identificação oficial `/etc/os-release`.

---

## 📁 Estrutura de Diretórios

```text
ForgeProvisioner/
|-- bin/
|   |-- start-ap.sh          # Inicialização do ponto de acesso via wpa_supplicant
|   |-- apply-client.sh      # Aplicação de credenciais cliente e validação de gateway
|   |-- watchdog.sh          # Monitoramento de conectividade e rollback automático
|   `-- forge-vm.sh          # Utilitário de virtualização / containeres
|-- branding/
|   |-- forge-banner         # Banner dinâmico ANSI split (Neofetch style)
|   |-- apply-branding.sh    # Script de aplicação de MOTD e issue
|   |-- forgeos-release      # Metadados de release ForgeOS
|   `-- issue                # Tela de console estática /etc/issue
|-- display/
|   |-- forge_kiosk.py       # Engine de Kiosk v3.0 em framebuffer (/dev/fb0)
|   `-- fonts/               # Tipografia Inter e JetBrains Mono embutidas
|-- network/
|   `-- wifi_manager.py      # Lógica de escaneamento e configuração de rede
|-- systemd/
|   |-- forge-ap.service     # Serviço de ponto de acesso Wi-Fi
|   |-- forge-portal.service # Serviço do servidor HTTP / portal REST
|   |-- forge-display.service# Serviço do kiosk HDMI
|   |-- forge-watchdog.service # Serviço do watchdog de rollback
|   `-- forge-fbcon-disable.service # Desativação de cursor no console HDMI
|-- web/
|   |-- server.py            # Daemon REST multi-thread
|   |-- index.html           # Interface web SPA moderna
|   |-- logo.png             # Logotipo oficial MultiForge
|   `-- logo-sm.png          # Logotipo otimizado para mobile
|-- tests/
|   |-- run_all.sh           # Suíte de validação e testes E2E
|   `-- test_api.py          # Testes de integração da API REST
`-- install.sh               # Instalador idempotente on-device (→ /opt/forgeos)
```

---

## ⚙️ Instalação no Dispositivo

Para instalar ou atualizar a pilha no hardware (ex: BTV Express E10 via SSH):

```bash
sudo bash /opt/forgeos/install.sh
```

Ou diretamente a partir da raiz do repositório:

```bash
sudo bash ForgeProvisioner/install.sh
```
