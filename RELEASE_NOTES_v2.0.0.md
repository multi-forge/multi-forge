# ForgeOS v2.0.0 — Production Release (Edge Appliance & MultiForge Platform)

Uma versão revolucionária de produção do **ForgeOS v2.0.0**, consolidando a evolução de um sistema de provisionamento básico para uma **Plataforma Completa de Edge Appliance & Inteligência Artificial na Borda**, desenvolvida sob medida para a placa **SEI Robotics SEI510 (BTV Express E10)** equipada com SoC **Amlogic S905X2**, 2GB de RAM e 8GB/16GB de eMMC.

Esta release marca a consagração do projeto desenvolvido no contexto do **1º Hackathon de Descaracterização de TV Boxes (Receita Federal / UNESP)**, transformando equipamentos apreendidos em totens acadêmicos e nós autônomos de IA e computação de borda.

---

## 🌟 Principais Novidades da v2.0.0

### 1. 🎛️ ForgeHub Core em Go (Zero Overhead & Performance Máxima)
* **Substituição Definitiva do Backend Python**: O daemon principal foi reescrito em **Go puro**, empacotado em um único binário estático com a interface de usuário React embutida nativamente via `//go:embed`.
* **Consumo Drástico de Memória**: Uso de RAM reduzido de ~70 MB para **menos de 15 MB**, liberando capacidade crítica para modelos de IA nos 2 GB de memória física da BTV E10.
* **Telemetria e Streaming SSE**: Dashboard web em tempo real com eventos Server-Sent Events (SSE) para logs, consumo de CPU, temperatura, memória e controle de módulos.

---

### 2. 🧩 Ecossistema Modular de Aplicações (`ForgeModules`)
* **Arquitetura Plug-and-Play**: A TV Box agora funciona como um appliance extensível com suporte a módulos declarativos via:
  * **Systemd Native Modules** (`manifest.yaml`): Serviços ultra-leves executados diretamente no sistema operacional.
  * **Docker Compose Modules** (`compose.yaml`): Microserviços isolados gerenciáveis diretamente pelo ForgeHub.
* **Módulos Nativos de Destaque**:
  * **M.A.B.I (Mina AI)**: Assistente virtual acadêmica com processamento de voz offline e consulta inteligente a bases acadêmicas.
  * **Web Scraping & RAG Agent**: Coletor de informações para alimentação de dados da universidade.

---

### 3. 🖥️ Kiosk Engine v3.0 Obsidian 1080p
* **Design System Obsidian**: Nova identidade visual com tema escuro de alta legibilidade, renderização vetorial Pillow e tipografia profissional (*JetBrains Mono* + *Inter*).
* **Painéis Inteligentes Reativos**:
  * **Pairing Mode**: Exibe QR Code Wi-Fi de conexão rápida no framebuffer HDMI (`/dev/fb0`).
  * **Connected Mode**: Oculta automaticamente credenciais do ponto de acesso para privacidade, exibindo IP da rede local e telemetria de hardware ao vivo.
* **Proteção contra Burn-in (Pixel-Shift)**: Deslocamento cíclico imperceptível de ±2px para prolongar a vida útil de TVs e telas públicas em funcionamento 24/7.

---

### 4. 📶 Controle Unificado de Rede (`forge-ap-ctrl`) & Watchdog 2.0
* **Ponto de Acesso de Resgate `Forge-E10`**: Controlador autônomo baseado em `wpa_supplicant mode=2` e `dnsmasq`, garantindo estabilidade máxima no chipset Wi-Fi RTL8189FTV.
* **Watchdog de Contingência**: Monitora a conectividade de nível 2 e 3. Se a conexão externa falhar por mais de 5 minutos, o ponto de acesso de emergência é restaurado sem necessidade de reiniciar o hardware.

---

### 5. ⚡ Kernel Linux 6.18 & DTB Enterprise
* **DTB Customizado**: Clock SDIO fixado em 25 MHz para estabilidade total do rádio Wi-Fi e CMA configurado em 64 MB.
* **Otimizações ZRAM (ZSTD)**: Expansão de memória virtual compactada em tempo real com algoritmo ZSTD, permitindo rodar cargas de trabalho com consumo equivalente a até 3.2 GB de RAM.

---

## 💾 Informações de Distribuição

* **Binário Oficial**: `ForgeOS_BTV_E10_v2.0.0.img.xz`
* **Compatibilidade**: Totalmente integrado ao **ForgeImager v2.1+** através do manifesto `forge-images.json`.
* **Hardware Homologado**: SEI Robotics SEI510 (BTV Express E10 / Amlogic S905X2 / 2GB RAM / 8GB eMMC).
