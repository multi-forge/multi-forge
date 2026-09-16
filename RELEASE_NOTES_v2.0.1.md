# ForgeOS v2.0.1 — Production Maintenance & Boot Fix Release

Versão de manutenção e correção do **ForgeOS v2.0.1** para o hardware **SEI Robotics SEI510 (BTV Express E10 / Amlogic S905X2)**.

Esta release resolve em definitivo o travamento na inicialização (boot freeze) observado após a gravação da imagem v2.0.0, assegura a integridade da pilha de console HDMI / Framebuffer Kiosk e consolida as melhorias de provisionamento e suporte a redes corporativas WPA-Enterprise (EAP).

---

## 🛠️ Correções e Melhorias da v2.0.1

### 1. 🖥️ Resolução do Boot Freeze & Dependências de Display
* **Inclusão de Runtime Python Essencial**: O pipeline de build agora instala nativamente `python3-pil` e `python3-qrcode` no chroot do rootfs base Armbian minimal, eliminando a exceção `ModuleNotFoundError: No module named 'PIL'`.
* **Eliminação de Conflitos de Framebuffer**: Aposentados definitivamente os serviços legados `forge-display.service` e `forge-portal.service`, deixando o Kiosk Obsidian (`forge-kiosk.service`) como renderizador exclusivo do `/dev/fb0`.
* **Proteção do Console TTY**: Removida a supressão destrutiva de `vtcon1` via `forge-fbcon-disable.service`. O Kiosk agora gerencia o cursor via `ExecStartPre/ExecStopPost`, mantendo `getty@tty2.service` sempre disponível como console de resgate seguro via teclado USB.
* **Fontes do Kiosk**: Tipografia profissional (*JetBrains Mono* e *Inter*) agora instalada em `/opt/forgehub/hardware/display/fonts/` com fallback automático.

### 2. 📶 Suporte Unificado a Redes EAP (WPA-Enterprise) & Controlador AP
* **Fluxo Flexível de Provisionamento**: Adicionada a opção de inicialização rápida ("Provisionar TV box" ou "Continuar sem provisionar"), permitindo o acesso direto ao dashboard sem necessidade de reconfiguração de Wi-Fi pré-existente.
* **Suporte a 802.1X / EAP**: Backend Go e frontend React com suporte a redes corporativas e acadêmicas (PEAP, TTLS, PWD, TLS) e upload de certificados CA/Cliente.
* **Controlador `forge-ap-ctrl`**: Gestão resiliente do Access Point `Forge-E10` integrado ao watchdog de contingência.

---

## 💾 Informações de Distribuição

* **Binário Oficial**: `ForgeOS_BTV_E10_v2.0.1.img.xz`
* **Compatibilidade**: Totalmente integrado ao **ForgeImager v2.1+** através do manifesto `forge-images.json`.
* **Hardware Homologado**: SEI Robotics SEI510 (BTV Express E10 / Amlogic S905X2 / 2GB RAM / 8GB eMMC).
