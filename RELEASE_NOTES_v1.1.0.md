# 🚀 ForgeOS v1.1.0 — Production Release (BTV Express E10 / Amlogic S905X2)

Uma versão de produção completa e refinada do **ForgeOS**, desenvolvida sob medida para a placa **SEI Robotics SEI510 (BTV Express E10)** equipada com SoC **Amlogic S905X2**, 2GB de RAM e 8GB/16GB de eMMC.

Esta release consolida o ciclo de auditoria de usabilidade e engenharia técnica (Nielsen H1–H10, WCAG 2.2 AA e 10-Foot UI Guidelines), oferecendo uma experiência visual de padrão internacional, telemetria térmica em tempo real, visualizador de logs RFC 5424 e conectividade inteligente via Captive Portal e HDMI Framebuffer (`/dev/fb0`).

---

## ✨ Principais Novidades & Melhorias

### 1. 📺 Display HDMI & Framebuffer 1080p (`/dev/fb0`)
* **10-Foot UI Design System:** Escala tipográfica calibrada para leitura nítida a 2,5 metros de distância em telas de TV.
* **Dual QR Code com Leitura Instantânea:**
  * **QR Code 1 (Conexão Wi-Fi Inteligente):** Padrão ZXing `WIFI:S:...` para associação direta com câmera do celular sem digitação.
  * **QR Code 2 (Acesso ao Painel):** Redirecionamento instantâneo para o portal web (`http://192.168.4.1:8080`).
* **Máquina de Estados Reativa no Kiosk:**
  * Modo **Pareamento (AP Ativo)**: Credenciais e passos de pareamento na tela.
  * Modo **Aplicando Conexão**: Feedback visual em tempo real com barra de progresso e Watchdog de 75s.
  * Modo **Operacional (Conectado à Rede)**: **Oculta credenciais do AP** para proteção de privacidade na TV e exibe o novo IP da rede e **Telemetria de Hardware ao Vivo** (Temperatura da CPU °C, Memória RAM, Uptime e saída HDMI).
* **Proteção Anti-Burn-In:** Pixel-shift sutil de ±2px cíclico para proteção contra retenção de imagem em painéis OLED e plasma.

---

### 2. 🌐 Portal Web & Painel de Controle ForgeOS (`:8080`)
* **Monitoramento Térmico em Tempo Real:** Leitura direta de `/sys/class/thermal/thermal_zone0/temp` na CPU S905X2 com alertas de temperatura (<70°C verde, 70-85°C âmbar, >85°C vermelho).
* **Denominadores & Barras de Recursos:** Exibição clara de RAM (`485 MB / 1.98 GB`) e eMMC (`3.5 GB / 28.7 GB`) com números tabulares (`font-variant-numeric: tabular-nums`).
* **Top 5 Processos do Kernel:** Tabela ao vivo dos processos com maior consumo de CPU e memória.
* **Visualizador de Logs RFC 5424:**
  * Filtros por severidade (*Todos, Erros, Avisos, Info, Debug*).
  * Filtro por unidade systemd (*forge-portal, forge-ap, forge-display, forge-watchdog, ssh, kernel*).
  * Modo *Tail -f* inteligente com pausa na rolagem manual e botão flutuante para retomar.
  * Exportação de arquivo `.log`, cópia com toast e limpeza segura (*vacuum*).
* **Gerenciador de Serviços systemd:** Estados ricos (*running, exited, starting, failed*), status de boot (*enabled/disabled*) e diálogos de confirmação para ações de segurança.
* **Paleta de Comandos (`Ctrl+K` / `⌘K`):** Navegação rápida por teclado para qualquer tela, serviço ou ação.
* **Design & Acessibilidade:** WCAG 2.2 AA, microcopy em *Sentence Case*, logotipo oficial e tema escuro industrial.

---

### 3. 🛡️ Segurança, Rede & Acesso SSH
* **SSH Ativo por Padrão no Boot:** Serviço SSH/SSHD habilitado com login de root permitido (`PermitRootLogin yes`).
* **Credenciais Padrão:** Usuário `root` e `kali` com senha `forge`.
* **Sub-rede Isolada do Ponto de Acesso:** `192.168.4.1` no modo AP para evitar colisões com redes locais comuns (`192.168.0.x` / `192.168.1.x`).
* **Watchdog de Contingência On-Boot:** Se a conexão Wi-Fi falhar ou perder sinal por mais de 75 segundos, o ponto de acesso de emergência é restaurado automaticamente.

---

## 💾 Instalação & Gravação da Imagem

1. Baixe o arquivo de imagem comprimida `ForgeOS_BTV_E10_v1.1.0.img.xz` e seu hash `.sha256`.
2. Use o **[ForgeImager](https://github.com/multi-forge/multi-forge/releases/tag/ForgeImager-v2.0.0)** ou o **Raspberry Pi Imager / BalenaEtcher** para gravar em um cartão MicroSD (classe 10 recomendado) ou diretamente na eMMC.
3. Insira na BTV Express E10 e ligue à tomada:
   * Conecte o cabo HDMI para acompanhar o status e o pareamento pelos QR Codes na TV.
   * Conecte seu celular ao ponto de acesso `RTL8189FTV_AP` (senha `tvbox12345`) ou aponte a câmera para o QR Code da tela.
   * Acesse `http://192.168.4.1:8080` para configurar o Wi-Fi doméstico/universitário (suporta WPA2 Personal e WPA-Enterprise / eduroam).
   * Para acesso remoto via terminal: `ssh root@192.168.4.1` (senha: `forge`).

---

## 📦 Arquivos da Release
* **`ForgeOS_BTV_E10_v1.1.0.img.xz`** — Imagem do sistema operacional bootável compactada com XZ multi-core.
* **`ForgeOS_BTV_E10_v1.1.0.img.xz.sha256`** — Hash de verificação de integridade criptográfica SHA-256.
