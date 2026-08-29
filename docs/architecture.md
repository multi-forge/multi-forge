# 🏗️ Arquitetura do MultiForge

Esta seção descreve a arquitetura geral do ecossistema MultiForge e como seus componentes cooperam para simplificar o reaproveitamento, gravação, provisionamento e execução de aplicações em hardware ARM legado.

---

## 🗺️ Visão Geral dos 4 Pilares

O MultiForge foi consolidado em **quatro pilares essenciais**:

```text
┌─────────────────────────────────────────────────────────┐
│                     ForgeImager                         │
│   (App Desktop Tauri v2 + Rust para gravação e injeção) │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼ (grava eMMC/SD + injeta ext4)
┌─────────────────────────────────────────────────────────┐
│                       ForgeOS                           │
│   (Stack On-Device: AP Cativo, Kiosk HDMI e Module Hub) │
└──────────────┬───────────────────────────┬──────────────┘
               │                           │
               ▼ (consulta metadados)      ▼ (instala/executa módulos)
┌────────────────────────────┐    ┌───────────────────────┐
│          ForgeDB           │    │     ForgeModules      │
│   (Banco de compatibilidade│    │  (Aplicações: Totem AI│
│   de hardware e módulos)   │    │   e Web Scraping RAG) │
└────────────────────────────┘    └───────────────────────┘
```

---

## 1. 🗄️ ForgeDB
A **fonte única de verdade (*Single Source of Truth*)** do projeto:
* **Hardware (`devices/`):** Mapeia especificações dos SoCs (Amlogic, Rockchip, Allwinner), chips Wi-Fi, árvores de dispositivos (DTBs) e particularidades de boot (como o `install-aml.sh`).
* **Módulos (`modules/`):** Catálogo central (`catalog.yaml`) e manifestos declarativos (`module.yaml`) que definem requisitos de RAM, dependências de sistema e comandos de ciclo de vida para cada aplicação.
* **Schemas (`schemas/`):** Schemas JSON Draft 2020-12 que validam a integridade dos metadados no CI/CD.

---

## 2. 💾 ForgeImager
A ferramenta desktop multiplataforma (Tauri v2 + React 19 + Rust):
* Permite escolher o fabricante, a placa e a imagem desejada consumindo manifestos remotos de GitHub Releases.
* **Injeção Userspace em Ext4 (`crates/forge-write-conf`):** Grava parâmetros de rede e primeiro boot diretamente na partição ext4 sem montar o filesystem ou requerer root.
* **Protocolo Sahara/EDL:** Recuperação de emergência para SoCs Qualcomm em modo MaskROM/EDL (`VID 0x05C6`).

---

## 3. 💿 ForgeOS
O sistema operacional enxuto e stack de provisionamento on-device:
* **AP Cativo Resiliente:** Opera em `192.168.4.1` via `wpa_supplicant` mode=2 para contornar a limitação de driver do rádio RTL8189FTV.
* **Portal Web SPA & REST API v2.1:** Interface industrial em modo escuro com scanner Wi-Fi dBm, suporte Eduroam/802.1X EAP e compatibilidade com conventions ESP32-SvelteKit (`/rest/*`).
* **MultiForge Module Hub:** Absorve a função de hub de software, permitindo instalar, iniciar, pausar e desinstalar aplicações diretamente pelo navegador.
* **Kiosk HDMI Framebuffer (`/dev/fb0`):** Renderiza Dual QR Code e telemetria em tempo real a 1080p sem X11/Wayland (economia de 500MB+ de RAM).
* **Watchdog de Contingência:** Monitor em background com rollback automático em 75s em caso de falha de associação cliente.

---

## 4. 📦 ForgeModules
As aplicações operacionais que rodam sobre o ForgeOS:
* **Totem (Mina AI):** Assistente virtual acadêmica para quiosques universitários com processamento de voz offline (Sherpa-ONNX), GUI PyQt5 e classificador MABI local.
* **Web-Scraping & RAG Agent:** Coletor assíncrono de dados universitários com FastAPI, LangChain RAG e variantes de deploy (`full` com Docker ou `lite` com SQLite local).
