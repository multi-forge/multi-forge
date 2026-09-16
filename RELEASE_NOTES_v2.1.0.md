# ForgeOS v2.1.0 — Boot Freeze Fix, Exclusive TTY Kiosk & Modern UI Release

**Release Oficial para BTV Express E10 (Amlogic S905X2 - 2GB RAM / 8GB eMMC)**

Esta versão consolida a resolução definitiva dos problemas de inicialização da v2.0.0, introduz o isolamento exclusivo do terminal virtual para o display Kiosk, implementa suporte completo a autenticação Wi-Fi corporativa (EAP / 802.1X) e traz o novo painel web e Kiosk Obsidian.

---

### 🚀 Principais Mudanças & Correções

#### 1. Resolução Definitiva do Travamento de Boot (Boot Freeze)
- **Causa Raiz da v2.0.0**: A imagem base minimal Armbian não continha as dependências `python3-pil` e `python3-qrcode`. O serviço `forge-fbcon-disable.service` desativava o console de vídeo antes do Kiosk iniciar, gerando tela preta ou sensação de travamento no boot.
- **Correção**: Injeção e pré-instalação obrigatória de `python3-pil`, `python3-qrcode`, `fonts-dejavu-core`, `qrencode` e fontes *Inter* e *JetBrains Mono* no chroot do builder.
- Desativação e mascaramento dos serviços conflitantes `forge-fbcon-disable.service`, `forge-display.service` e `forge-portal.service`.

#### 2. Isolamento Exclusivo de TTY para o Display Kiosk
- O Kiosk Obsidian agora opera com reserva de terminal virtual:
  - `getty@tty1.service` desativado e mascarado por padrão, impedindo sobreposição de texto ou cursores no painel gráfico HDMI (`/dev/fb0`).
  - Terminal interativo físico local disponível em `getty@tty2.service` (acessível via `Ctrl+Alt+F2`).
  - Parâmetros do kernel otimizados com `quiet loglevel=3` no `uEnv.txt` para suprimir prints de debug do kernel sobre o framebuffer.
  - Supressão ativa de cursor e blanking no `forge-kiosk.service` (`setterm -cursor off -blank 0`).

#### 3. Wi-Fi Enterprise (WPA2/WPA3 EAP 802.1X) & Provisionamento AP
- Suporte a redes corporativas e acadêmicas (ex: *eduroam*, redes universitárias e corporativas) via `PEAP` / `MSCHAPv2` e `TTLS`.
- Controlador `forge-ap-ctrl` aprimorado com fallback automático (watchdog de contingência de 75s).
- DTB Enterprise dedicado para BTV E10 (`meson-g12a-btv-e10-enterprise.dtb`) com clock correto de 25MHz para o módulo RTL8189FTV e 64MB CMA.

#### 4. Kiosk Obsidian & Novo Portal Web
- Renderização nativa 1080p no `/dev/fb0` com cards informativos, QR Code para conexão Wi-Fi instantânea e QR Code para abertura do portal.
- Telemetria de hardware em tempo real: Temperatura da CPU (S905X2), Uso de Memória RAM, Uptime e status de rede.
- Novo portal web com design moderno, paleta de comandos (`Ctrl+K`), recursos de acessibilidade, gráficos Sparkline de latência/CPU/RAM e gerenciador de serviços do sistema.

---

### 📦 Informações do Artefato

- **Nome da Imagem**: `ForgeOS_BTV_E10_v2.1.0.img.xz`
- **Plataforma**: Amlogic S905X2 (ARM64 / aarch64)
- **Kernel**: Linux 6.18.44-ophub
- **Formato**: `.img.xz` compatível com ForgeImager, BalenaEtcher e Raspberry Pi Imager.
- **Credenciais Padrão**:
  - `root` / `forge` (ou `kali`)
  - `kali` / `forge` (ou `kali`)
