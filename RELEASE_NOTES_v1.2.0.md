# ForgeOS v1.2.0 — Production Release (BTV Express E10 / Amlogic S905X2)

Uma versão de produção completa, refinada e modular do **ForgeOS**, desenvolvida sob medida para a placa **SEI Robotics SEI510 (BTV Express E10)** equipada com SoC **Amlogic S905X2**, 2GB de RAM e 8GB/16GB de eMMC.

Esta release consolida a transição completa para a identidade autônoma do **ForgeOS**, separação arquitetural em **ForgeCore** e **ForgeProvisioner**, o novo **Kiosk Engine v3.0** com transições suaves anti-flicker, banner de terminal com as cores oficiais do MultiForge e verificação automatizada de boot via **QEMU ARM64**.

---

## 🌟 Principais Novidades & Melhorias

### 1. Kiosk Engine v3.0 no Framebuffer HDMI (`/dev/fb0`)
* **Transições Suaves Anti-Flicker:** Renderizador gráfico com slide direcional e atualização inteligente de buffer, eliminando oscilações na TV.
* **Detecção de Conexão L2 & Máquina de Estados Reativa:**
  * **Modo Pareamento (AP Ativo):** Exibe QR Code Wi-Fi inteligente de 1 toque (`WIFI:S:...`) e instruções claras para conexão.
  * **Modo Aplicando:** Feedback visual em tempo real com barra de progresso durante a tentativa de associação.
  * **Modo Operacional (Conectado):** **Oculta as credenciais do AP por privacidade** e exibe o novo IP obtido na rede local junto a telemetria ao vivo da CPU, RAM e Uptime.
* **Proteção de Painel (Pixel-Shift):** Deslocamento cíclico imperceptível de ±2px para proteção contra burn-in em TVs e monitores.

---

### 2. Branding Oficial MultiForge & Terminal Split (Neofetch-Style)
* **Banner Dinâmico ANSI em Cores Reais:**
  * **Chama da Forja (Topo):** Gradiente de calor (Laranja avermelhado `#ff5f00`, Laranja `#ff8700` e Âmbar dourado `#ffaf00`).
  * **Bigorna & Sondas (Base):** Turquesa e Ciano Neon brilhante (`#00ffff` e `#00d7d7`).
  * **Painel de Métricas em Tempo Real:** 74 colunas × 20 linhas (cabe perfeitamente em 80 colunas sem quebrar), com CPU Temp, Memória + ZRAM, Storage e status de serviços (`:ok` em verde, `:falha` em vermelho).
* **Auto-Detecção TTY & Modo `--plain`:** Em conexões TTY/SSH exibe as cores completas; quando redirecionado para logs ou serial remove códigos ANSI automaticamente.
* **Telas de Console:** Telas `/etc/issue` e `/etc/issue.net` oficiais padronizadas.

---

### 3. Desacoplamento Total do Armbian
* **Identidade de Sistema Nativa:** `/etc/os-release` puro identificando `NAME="ForgeOS"`, `ID=forgeos`, `VERSION="1.2.0"`.
* **Desativação de Serviços Legados:** Serviços residuais do Armbian (`armbian-led-state`, `armbian-firstrun`, `armbian-hardware-monitor`, etc.) desativados e mascarados.
* **MOTD Limpo:** Fragmentos legados silenciados, garantindo login SSH imediato sem mensagens duplicadas.

---

### 4. Arquitetura Modular no Repositório
* **`ForgeCore/`:** Núcleo do SO, Kernel Linux 6.18, DTB Enterprise (SDIO 25 MHz, 64MB CMA), scripts de compilação em Spot VM (`gcp-spot-launcher.py`) e harness de verificação virtual QEMU.
* **`ForgeProvisioner/`:** Pilha de provisionamento on-device (`install.sh`, rede AP/Client, Kiosk HDMI, Portal HTTP e watchdog de contingência).

---

### 5. Validação Virtual de Boot com QEMU AArch64 (Risco Zero de Brick)
* Cada compilação passa por uma inicialização simulada em máquina virtual ARM64 (QEMU Cortex-A53) antes do empacotamento:
  * Descompressão do kernel `zImage` e montagem do `uInitrd`.
  * Montagem e checagem do sistema de arquivos raiz `ext4 rw`.
  * Inicialização dos serviços fundamentais do Systemd.
* Log de validação anexado aos artefatos (`qemu-boot-test.log`).

---

## ⚡ Compatibilidade com o ForgeImager

Esta release é 100% compatível com o **[ForgeImager v2.1.0](https://github.com/multi-forge/multi-forge/releases/tag/ForgeImager-v2.1.0)**:
* O manifesto [`forge-images.json`](forge-images.json) foi atualizado para apontar para a versão `v1.2.0`.
* A nomenclatura do binário `ForgeOS_BTV_E10_v1.2.0.img.xz` e seu hash `.sha256` seguem a especificação de autodescoberta do gravador.

---

## 💾 Download dos Artefatos

| Arquivo | Tamanho | SHA-256 |
| :--- | :--- | :--- |
| **`ForgeOS_BTV_E10_v1.2.0.img.xz`** | ~479 MB | `8cf52c8d3c37ef58a90fe97bc86ca9e36745f6ed351d2beb7a2808d6a9e28540` |
| **`ForgeOS_BTV_E10_v1.2.0.img.xz.sha256`** | 96 B | Checksum oficial para integridade de gravação |
| **`forge-images.json`** | ~1.5 KB | Manifesto de catálogo para o ForgeImager |
| **`qemu-boot-test.log`** | ~77 KB | Telemetria de boot virtual capturada pelo QEMU |
