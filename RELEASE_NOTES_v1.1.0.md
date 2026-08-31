<p align="center">
  <img src="https://raw.githubusercontent.com/gasiepgodoy/Hackathon-TV-Box-E10/main/Projeto%20Equipe%201/imagens/logo.png" alt="MultiForge Banner" width="100%" />
</p>

# ForgeOS v1.1.0 — Production Release (BTV Express E10 / Amlogic S905X2)

Uma versao de producao completa e refinada do **ForgeOS**, desenvolvida sob medida para a placa **SEI Robotics SEI510 (BTV Express E10)** equipada com SoC **Amlogic S905X2**, 2GB de RAM e 8GB/16GB de eMMC.

Esta release consolida o ciclo de auditoria de usabilidade e engenharia tecnica (Nielsen H1–H10, WCAG 2.2 AA e 10-Foot UI Guidelines), oferecendo uma experiencia visual de padrao internacional, telemetria termica em tempo real, visualizador de logs RFC 5424 e conectividade inteligente via Captive Portal e HDMI Framebuffer (`/dev/fb0`).

---

## Principais Novidades & Melhorias

### 1. Display HDMI & Framebuffer 1080p (`/dev/fb0`)
* **10-Foot UI Design System:** Escala tipografica calibrada para leitura nitida a 2,5 metros de distancia em telas de TV.
* **Dual QR Code com Leitura Instantanea:**
  * **QR Code 1 (Conexao Wi-Fi Inteligente):** Padrao ZXing `WIFI:S:...` para associacao direta com camera do celular sem digitacao.
  * **QR Code 2 (Acesso ao Painel):** Redirecionamento instantaneo para o portal web (`http://192.168.4.1:8080`).
* **Maquina de Estados Reativa no Kiosk:**
  * Modo **Pareamento (AP Ativo)**: Credenciais e passos de pareamento na tela.
  * Modo **Aplicando Conexao**: Feedback visual em tempo real com barra de progresso e Watchdog de 75s.
  * Modo **Operacional (Conectado a Rede)**: **Oculta credenciais do AP** para protecao de privacidade na TV e exibe o novo IP da rede e **Telemetria de Hardware ao Vivo** (Temperatura da CPU °C, Memoria RAM, Uptime e saida HDMI).
* **Protecao Anti-Burn-In:** Pixel-shift sutil de ±2px ciclico para protecao contra retencao de imagem em paineis OLED e plasma.

---

### 2. Portal Web & Painel de Controle ForgeOS (`:8080`)
* **Monitoramento Termico em Tempo Real:** Leitura direta de `/sys/class/thermal/thermal_zone0/temp` na CPU S905X2 com alertas de temperatura (<70°C verde, 70-85°C ambar, >85°C vermelho).
* **Denominadores & Barras de Recursos:** Exibicao clara de RAM (`485 MB / 1.98 GB`) e eMMC (`3.5 GB / 28.7 GB`) com numeros tabulares (`font-variant-numeric: tabular-nums`).
* **Top 5 Processos do Kernel:** Tabela ao vivo dos processos com maior consumo de CPU e memoria.
* **Visualizador de Logs RFC 5424:**
  * Filtros por severidade (*Todos, Erros, Avisos, Info, Debug*).
  * Filtro por unidade systemd (*forge-portal, forge-ap, forge-display, forge-watchdog, ssh, kernel*).
  * Modo *Tail -f* inteligente com pausa na rolagem manual e botao flutuante para retomar.
  * Exportacao de arquivo `.log`, copia com toast e limpeza segura (*vacuum*).
* **Gerenciador de Servicos systemd:** Estados ricos (*running, exited, starting, failed*), status de boot (*enabled/disabled*) e dialogos de confirmacao para acoes de seguranca.
* **Paleta de Comandos (`Ctrl+K` / `⌘K`):** Navegacao rapida por teclado para qualquer tela, servico ou acao.
* **Design & Acessibilidade:** WCAG 2.2 AA, microcopy em *Sentence Case*, logotipo oficial e tema escuro industrial.

---

### 3. Seguranca, Rede & Acesso SSH
* **SSH Ativo por Padrao no Boot:** Servico SSH/SSHD habilitado com login de root permitido (`PermitRootLogin yes`).
* **Credenciais Padrao:** Usuario `root` e `kali` com senha `forge`.
* **Sub-rede Isolada do Ponto de Acesso:** `192.168.4.1` no modo AP para evitar colisoes com redes locais comuns (`192.168.0.x` / `192.168.1.x`).
* **Watchdog de Contingencia On-Boot:** Se a conexao Wi-Fi falhar ou perder sinal por mais de 75 segundos, o ponto de acesso de emergencia e restaurado automaticamente.

---

## Instalacao & Gravacao da Imagem

1. Baixe o arquivo de imagem comprimida `ForgeOS_BTV_E10_v1.1.0.img.xz` e seu hash `.sha256`.
2. Use o **[ForgeImager](https://github.com/multi-forge/multi-forge/releases/tag/ForgeImager-v2.0.0)** ou o **Raspberry Pi Imager / BalenaEtcher** para gravar em um cartao MicroSD (classe 10 recomendado) ou diretamente na eMMC.
3. Insira na BTV Express E10 e ligue a tomada:
   * Conecte o cabo HDMI para acompanhar o status e o pareamento pelos QR Codes na TV.
   * Conecte seu celular ao ponto de acesso `RTL8189FTV_AP` (senha `tvbox12345`) ou aponte a camera para o QR Code da tela.
   * Acesse `http://192.168.4.1:8080` para configurar o Wi-Fi domestico/universitario (suporta WPA2 Personal e WPA-Enterprise / eduroam).
   * Para acesso remoto via terminal: `ssh root@192.168.4.1` (senha: `forge`).

---

## Arquivos da Release
* **`ForgeOS_BTV_E10_v1.1.0.img.xz`** — Imagem do sistema operacional bootavel compactada com XZ multi-core.
* **`ForgeOS_BTV_E10_v1.1.0.img.xz.sha256`** — Hash de verificacao de integridade criptografica SHA-256.
