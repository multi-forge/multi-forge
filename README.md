# 🛠️ MultiForge

<p align="center">
  <img src="imagens/logo.png" width="1280" alt="MultiForge Logo/Banner">
</p>

Plataforma open-source para identificação, compatibilização, provisionamento e modularização de hardware reaproveitado (TV Boxes e dispositivos ARM legados).

> **O núcleo do projeto**: MultiForge é uma plataforma para identificar, compatibilizar, provisionar e modularizar TV Boxes reaproveitadas, com o **ForgeDB** como base de conhecimento, o **ForgeHub** como ecossistema de módulos, o **ForgeImager** como interface de gravação, o **Forge Provisioner** como configuração inicial e o **Forge Agent** como inventário contínuo.

---

## 🗺️ Visão Geral

O MultiForge não é apenas uma distribuição Linux ou um instalador isolado. É uma plataforma projetada para reaproveitar hardware de TV Boxes descartadas ou apreendidas (como a **BTV E10**), transformando-as em equipamentos úteis (servidores de borda, bibliotecas digitais, nós de IoT e inteligência ativa) com baixa complexidade de compatibilidade e instalação guiada.

```text
TV Box apreendida/legada
  │
  ▼
Identificação & Compatibilidade
  │
  ▼
Imagem Compatível Selecionada
  │
  ▼
Provisionamento Inteligente
  │
  ▼
Instalação de Módulos (Profiles)
  │
  ▼
Equipamento Útil e Ativo
```

---

## 🔍 Detalhamento do Ecossistema

### 1. 🗄️ ForgeDB (Banco de Compatibilidade)
O ForgeDB é o coração da plataforma. Ele **não é** apenas uma lista de imagens ou um repositório de firmwares copiados, mas sim um banco de dados de metadados, links de referência, rastreabilidade e evidências de hardware.
* **Dados Armazenados**: Nome do dispositivo, fabricante, modelo, revisão da placa, SoC, GPU, RAM, armazenamento, Wi-Fi, Bluetooth, Ethernet, USB, HDMI, boot modes, método de flash, kernel recomendado, DTB, firmwares, imagens compatíveis, problemas conhecidos, tutoriais, fotos e fontes.

```text
forgedb/
├── devices/
│   └── btv/
│       └── e10/
│           ├── device.yaml
│           ├── docs/
│           ├── photos/
│           ├── revisions/
│           └── images.yaml
├── soc/
├── boards/
├── kernels/
├── bootloaders/
├── dtbs/
├── firmwares/
├── flash/
├── schemas/
├── evidence/
└── sources/
```

### 2. 🔌 ForgeHub (Catálogo de Módulos)
Catálogo/marketplace que gerencia a instalação de pacotes opcionais que rodam sobre o sistema operacional.
* **Níveis de Confiança/Origem**:
  * `Official`: Módulos desenvolvidos pela equipe MultiForge.
  * `Verified`: Módulos de terceiros auditados na CI.
  * `Community`: Módulos mantidos pela comunidade.
  * `Private`: Módulos internos/locais do usuário.
* **Manifesto do Módulo**: Cada módulo possui um arquivo descritivo com id, nome, versão, autor/publicador, licença, arquitetura suportada, dependências, permissões, serviços instalados e scripts de ciclo de vida.
* **Exemplos de Módulos**: Docker, Home Assistant, Jellyfin, Kodi, Ollama, Node-RED, Pi-hole, Tailscale, Samba, Assistente IA, Dashboard.

### 3. 💿 ForgeOS (Sistema Operacional)
A camada mínima e padrão de sistema operacional.
* **Estratégia**: Iniciar utilizando imagens estáveis existentes (Armbian, Educabox, Debian) como base e evoluir para uma imagem customizada própria no futuro.
* **Características**: Imagem base pequena contendo kernel, DTB, drivers, bootloader compatível, gerenciador de módulos, atualizador, CLI, Forge Agent e Forge Provisioner. As capacidades completas são ativadas sob demanda por meio de perfis de módulos.

### 4. 💾 ForgeImager (Ferramenta de Gravação)
Interface gráfica para preparar a mídia de instalação (Cartão SD ou eMMC).
* **Estratégia de Injeção**: Em vez de reconstruir ou editar arquivos internos da imagem a cada gravação (o que gera complexidade com senhas e incompatibilidades), o ForgeImager apenas grava a imagem limpa e injeta um manifesto `forge.yaml` na partição de boot contendo as definições de rede (Wi-Fi, IP), credenciais locais (usuário e senhas com hash) e perfil desejado.

### 5. ⚙️ Forge Provisioner (Provisionador)
Componente ativo executado automaticamente no primeiro boot do dispositivo.
* **Função**: Lê o manifesto `forge.yaml` injetado pelo ForgeImager, cria os usuários com credenciais seguras, define hostname/locale/timezone, conecta à rede Wi-Fi/SSH, instala os módulos solicitados e executa a limpeza pós-instalação (apagando o manifesto).

### 6. 🕵️ Forge Agent (Agente Local)
Serviço executado continuamente em background no dispositivo.
* **Função**: Realiza o inventário do hardware real e coleta dados de diagnóstico após o Linux subir (método mais seguro do que tentar descobrir tudo antes da instalação). Permite o envio opcional de relatórios de conformidade e telemetria para o ForgeDB.

### 7. 💻 Forge CLI (Interface de Terminal)
Comando unificado para interação local e depuração no dispositivo:
```bash
multiforge detect        # Detecção de periféricos e plataforma
multiforge info          # Exibe dados detalhados da plataforma
multiforge search        # Busca de módulos no ForgeHub
multiforge install       # Instala componentes adicionais
multiforge modules       # Gerencia os módulos ativos
multiforge doctor        # Diagnóstico completo (SoC, DTB, firmware, Wi-Fi, etc)
```

---

## 📡 Identificação de Hardware Realista

Após testes de arquitetura, foram estabelecidas as seguintes premissas de design:
* **Descartado**: Depender de SSH ativo, varredura de IP, Android com ADB, ou USB tethering para a descoberta inicial do dispositivo (métodos frágeis).
* **Viável (Duas Fases)**:
  * **Fase 1 (Descoberta Superficial)**: O ForgeImager/CLI detecta apenas as informações necessárias para um flash seguro (SoC, fabricante e status do boot mode: MaskROM, FEL, USB Burning ou Fastboot).
  * **Fase 2 (Descoberta Completa)**: Após a primeira inicialização do Linux, o **Forge Agent** executa a identificação completa de barramentos, chips de Wi-Fi/Bluetooth e memória interna.

---

## 🔄 Fluxo de Trabalho Integrado

```text
Usuário abre o ForgeImager 
  │
  ▼
Seleciona o dispositivo ou consulta o guia
  │
  ▼
ForgeDB filtra as imagens e DTBs compatíveis
  │
  ▼
Usuário escolhe a Imagem Base e o Perfil de Módulos (ex: media-center)
  │
  ▼
ForgeImager grava a mídia e injeta o arquivo "forge.yaml"
  │
  ▼
Primeiro Boot no dispositivo ➔ Forge Provisioner aplica credenciais, rede e instala módulos
  │
  ▼
Forge Agent roda em background, cataloga o hardware e atualiza o status
```

---

## 🎯 Caso Piloto: BTV E10

A **BTV E10** serve como o dispositivo de referência e prova de conceito do projeto para validação prática.

| Atributo | Especificação Catalogada |
| :--- | :--- |
| **Codename / Modelo** | BTVE10 / E10 |
| **Fabricante** | BTV |
| **Placa Mãe** | BTVE E10-LPDDR4 V.10 201-03-08 |
| **SoC / CPU** | Amlogic S905X2 (Cortex-A53) [Conflito: Rockchip RK3566 em README] |
| **GPU** | Mali-G31 MC1 |
| **Wi-Fi** | RTL8189FTV [Conflito: AP6256 em README] |
| **Memória / Flash** | 2GB RAM / 8GB eMMC |
| **DTB Recomendada** | `meson-g12a-sei510.dtb` (Placa DTB: `g12a_u212_2g`) |

---

## 🎨 Perfis e Módulos do Sistema

O sistema utiliza imagens base pequenas e estende suas capacidades por meio de perfis funcionais que agrupam módulos do **ForgeHub**:

* **Perfil: `media-center`**
  ```yaml
  profile: media-center
  modules:
    - kodi
    - jellyfin
    - samba
  ```
* **Perfil: `iot-gateway`**
  ```yaml
  profile: iot-gateway
  modules:
    - mosquitto
    - node-red
    - homeassistant
  ```
* **Perfil: `ai-node`**
  ```yaml
  profile: ai-node
  modules:
    - ollama
    - open-webui
    - whisper
  ```

---

## 📁 Estrutura Organizacional do Repositório

```text
multiforge/
├── README.md           # Visão geral e documentação principal
├── LICENSE             # Licença MIT
├── docs/               # Documentação técnica e guias de identificação
├── cli/                # Código-fonte da ferramenta Forge CLI
├── detector/           # Ferramentas de detecção superficial de hardware
├── database/           # Modelos de dados e esquemas do ForgeDB
├── provisioner/        # Lógicas do Forge Provisioner (primeiro boot)
├── builder/            # Scripts de build e compilação de imagens
├── agent/              # Daemon do Forge Agent
├── modules/            # Definições e manifestos dos módulos do ForgeHub
├── server/             # Backend do ForgeDB e ForgeHub
├── web/                # Interface web do catálogo
├── tests/              # Testes unitários e de integração
└── scripts/            # Scripts de automação do repositório
```

---

## 📜 Licença

Este projeto está sob a licença **MIT**.
