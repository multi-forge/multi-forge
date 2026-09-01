# Como Adicionar Seu Dispositivo ao ForgeDB

Bem-vindo ao guia de contribuição de hardware para o **ForgeDB**!

O **ForgeDB** é a base de dados centralizada e declarativa que alimenta todo o ecossistema MultiForge (**ForgeOS**, **ForgeImager**, **Forge Agent** e ferramentas de linha de comando). Se você portou o ForgeOS para uma nova TV Box, SBC ou placa ARM/x86/RISC-V, siga este guia para submeter seu dispositivo ao catálogo oficial.

---

## 1. Pré-requisitos

1. **Conta no GitHub** com fork do repositório [`multi-forge/multi-forge`](https://github.com/multi-forge/multi-forge).
2. **Node.js 18+** ou **Python 3.9+** para validação local de schemas JSON.
3. Informações completas do dispositivo:
   - Identificação do SoC (vendor, modelo, arquitetura, frequência máxima, cores).
   - Memória RAM e armazenamento onboard (eMMC, NAND, SD, etc.).
   - Chipset Wi-Fi / Bluetooth e interface de barramento (SDIO, USB, PCIe).
   - Dados de extração do Linux/Android para fingerprints (`/proc/cpuinfo`, `/proc/device-tree/compatible`, etc.).
   - Arquivo DTB compilado (`.dtb`) testado e funcional.
   - Fotos nítidas da carcaça e da placa (PCB) com marcações visíveis.

---

## 2. Passo a Passo da Contribuição

### Passo 1: Crie uma branch de trabalho
```bash
git clone https://github.com/SEU_USUARIO/multi-forge.git
cd multi-forge
git checkout -b add-device-fabricante-modelo
```

### Passo 2: Crie a estrutura de diretórios do dispositivo
Dentro de `ForgeDB/devices/`, crie uma pasta com o slug do fabricante e uma subpasta com o modelo:

```text
ForgeDB/
├── devices/
│   └── <fabricante>/
│       └── <modelo>/
│           ├── device.yaml       # Metadados de hardware, fingerprints e boot
│           ├── images.yaml       # Imagens de SO disponíveis para download
│           ├── dtb/              # Arquivo(s) .dtb compilado(s)
│           │   └── meson-*.dtb
│           └── photos/           # Fotos da placa (PCB) e da carcaça
│               ├── board.jpg
│               └── case.jpg
└── vendors/
    └── <fabricante>.yaml         # Metadados do fabricante (caso não exista)
```

Exemplo prático:
`ForgeDB/devices/btv/e10/device.yaml`

---

## 3. Template do `device.yaml`

Crie o arquivo `devices/<fabricante>/<modelo>/device.yaml` utilizando o schema `forgedb/v2`:

```yaml
# Identificador do Schema
schema: forgedb/v2

# Identificadores do dispositivo
id: meu-fabricante-modelo      # Identificador unico (letras minusculas, numeros, hifens e underscores)
slug: meu-fabricante-modelo    # Slug para URLs e catalogo web
name: "Nome Comercial Completo" # Ex: "BTV Express E10" ou "Tanix TX3 Mini"
manufacturer: meu-fabricante   # Slug do fabricante (deve existir em vendors/<fabricante>.yaml)
category: tv-box               # Opcoes: tv-box, sbc, router, nas, mini-pc, other
status: supported              # Opcoes: supported, experimental, community, eol
description: "Descricao curta e objetiva com SoC, memoria e detalhes de conectividade."

# Especificacoes de Hardware
hardware:
  soc:
    vendor: Amlogic            # Fabricante do SoC (ex: Amlogic, Rockchip, Allwinner)
    model: S905X2              # Modelo do chip (ex: S905X2, RK3588, H616)
    family: meson-g12a         # Familia do kernel Linux (ex: meson-g12a, rk356x)
    architecture: arm64        # Opcoes: arm64, armv7, x86_64, riscv64
    cores: 4                   # Quantidade de nucleos de CPU
    cpu: Cortex-A53            # Microarquitetura dos nucleos
    max_freq_mhz: 1800         # Frequencia maxima suportada em MHz
  memory:
    ram: 2GB                   # Formato: ^[0-9]+(MB|GB)$ (ex: 2GB, 4GB, 512MB)
    storage: 8GB               # Formato: ^[0-9]+(MB|GB|TB)$ (ex: 8GB, 16GB, 1TB)
    storage_type: emmc         # Opcoes: emmc, sd, nand, ufs, sata, nvme
  wireless:
    wifi: RTL8189FTV           # Chipset Wi-Fi (ex: RTL8189FTV, AP6255, XR819)
    wifi_bus: sdio             # Opcoes: sdio, usb, pcie
    bluetooth: null            # Chipset Bluetooth ou null se nao houver suporte
  ports:
    usb2: 1                    # Quantidade de portas USB 2.0
    usb3: 1                    # Quantidade de portas USB 3.0+
    hdmi: 1                    # Quantidade de saidas HDMI
    ethernet: 1                # Quantidade de portas Ethernet RJ45
    sd_card: false             # Possui slot para cartao SD / microSD (true/false)
    av: true                   # Possui saida analogica AV / P2 (true/false)

# Assinaturas de Hardware para Autodeteccao (Forge Agent e ForgeImager)
fingerprints:
  cpuinfo:
    hardware: "Amlogic"        # Campo 'Hardware' retornado em /proc/cpuinfo
    cpu_family: "g12a"         # Familia de CPU
    serial_prefix: null        # Prefixo de serial se aplicavel ou null
  device_tree:
    compatible:                # Lista de strings compativeis do Device Tree
      - "fabricante,modelo"
      - "seirobotics,sei510"
      - "amlogic,g12a"
    model: "Modelo Comercial*" # Padrao glob para casar com /proc/device-tree/model
  usb:
    - vid: "1b8e"              # USB Vendor ID (hexadecimal)
      pid: "c003"              # USB Product ID (hexadecimal)
      description: "GX-CHIP*"  # Descritor USB retornado em modo maskrom/recovery
  storage_model:
    patterns:                  # Padroes glob para modelo do disco/armazenamento
      - "*S905X2*"
      - "*MODELO*"
  pcb_markings:                # Marcacoes serigrafadas na placa-mae
    - "REVISAO_DA_PLACA V1.0 2021-01-01"

# Parametros e Ferramentas de Inicializacao / Gravacao
boot:
  dtb: meson-g12a-meu-modelo.dtb      # Nome do DTB principal fornecido
  dtb_fallback: meson-g12a-sei510.dtb # DTB generico ou fallback
  aml_autoscript: true                # Suporta aml_autoscript (TV Boxes Amlogic)
  preferred_flash_tool: install-aml.sh # Script padrao de instalacao interna
  recovery_method: maskrom-usb        # Opcoes: maskrom-usb, edl, jtag, uart, sd-boot, none
  boot_media:                         # Midias aceitas para boot
    - sd
    - emmc

# Problemas Conhecidos e Contornos (Workarounds)
known_issues:
  - title: "armbian-install incompativel"
    severity: medium                  # Opcoes: low, medium, high, critical
    description: "O script armbian-install padrao corrompe a tabela de particoes."
    workaround: "Utilizar o script install-aml.sh do ForgeOS para instalacao interna."
```

---

## 4. Template do `images.yaml`

Crie o arquivo `devices/<fabricante>/<modelo>/images.yaml` utilizando o schema `forgedb-images/v1`:

```yaml
schema: forgedb-images/v1
device_id: meu-fabricante-modelo # Deve coincidir exatamente com o id de device.yaml

images:
  - id: forgeos-meu-modelo-desktop
    distribution: ForgeOS
    variant: desktop            # Opcoes: desktop, server, minimal, iot
    version: "1.0.0"
    kernel:
      branch: current           # Opcoes: current, edge, legacy
      version: "6.1.y"
    stability: stable           # Opcoes: stable, testing, nightly
    recommended: true           # Define a imagem padrao recomendada
    download:
      url: "https://github.com/multi-forge/multi-forge/releases/download/v1.0.0/forgeos-meu-modelo-desktop.img.xz"
      sha256_url: "https://github.com/multi-forge/multi-forge/releases/download/v1.0.0/forgeos-meu-modelo-desktop.img.xz.sha256"
      size_bytes: 524288000
      format: img.xz            # Opcoes: img.xz, img.gz, img.zst, img.bz2, img, iso, qdl.zip
    flash_target:
      - sd
      - emmc

  - id: forgeos-meu-modelo-server
    distribution: ForgeOS
    variant: server
    version: "1.0.0"
    kernel:
      branch: current
      version: "6.1.y"
    stability: stable
    recommended: false
    download:
      url: "https://github.com/multi-forge/multi-forge/releases/download/v1.0.0/forgeos-meu-modelo-server.img.xz"
      sha256_url: null
      size_bytes: 314572800
      format: img.xz
    flash_target:
      - sd
      - emmc
```

---

## 5. Template do Fabricante (`vendors/<fabricante>.yaml`)

Se o fabricante do dispositivo ainda não estiver cadastrado em `ForgeDB/vendors/`, crie o arquivo `ForgeDB/vendors/<fabricante>.yaml`:

```yaml
id: meu-fabricante             # Slug do fabricante (letras minusculas e hifens)
name: "Nome da Empresa"        # Nome de exibicao
logo_url: null                 # URL direta para a logo (ou null)
website: null                  # Site oficial (ou null)
description: "Fabricante de dispositivos de hardware e TV boxes"
country: "BR"                  # Codigo ISO de duas letras do pais (ex: BR, CN, US)
```

---

## 6. Como Validar Localmente

Antes de enviar o Pull Request, execute a validação dos arquivos YAML contra os schemas JSON formais:

### Opção A: Usando Node.js e `ajv-cli` (Recomendado)

```bash
# Validar device.yaml
npx --yes js-yaml ForgeDB/devices/meu-fabricante/modelo/device.yaml > temp_device.json
npx --yes ajv-cli validate --spec=draft2020 --strict=false -s ForgeDB/schemas/device.schema.json -d temp_device.json

# Validar images.yaml
npx --yes js-yaml ForgeDB/devices/meu-fabricante/modelo/images.yaml > temp_images.json
npx --yes ajv-cli validate --spec=draft2020 --strict=false -s ForgeDB/schemas/image.schema.json -d temp_images.json

# Validar vendors.yaml
npx --yes js-yaml ForgeDB/vendors/meu-fabricante.yaml > temp_vendor.json
npx --yes ajv-cli validate --spec=draft2020 --strict=false -s ForgeDB/schemas/vendor.schema.json -d temp_vendor.json
```

### Opção B: Usando Python

```bash
python -c "
import yaml, json, jsonschema
with open('ForgeDB/devices/meu-fabricante/modelo/device.yaml') as f:
    data = yaml.safe_load(f)
with open('ForgeDB/schemas/device.schema.json') as f:
    schema = json.load(f)
jsonschema.validate(instance=data, schema=schema)
print('device.yaml valido com sucesso!')
"
```

---

## 7. Submissão de Pull Request

1. Garanta que todas as alterações estão commitadas com mensagens claras no padrão Conventional Commits:
   ```bash
   git add ForgeDB/devices/meu-fabricante/ ForgeDB/vendors/
   git commit -m "feat(forgedb): add support for Fabricante Modelo"
   ```
2. Envie o branch para o seu fork no GitHub:
   ```bash
   git push origin add-device-fabricante-modelo
   ```
3. Abra um **Pull Request** para a branch `main` do repositório `multi-forge/multi-forge`.
4. Preencha a descrição do PR incluindo:
   - Fotos da placa e serigrafia do SoC / RAM.
   - Logs de boot do Linux (saída de `dmesg` ou console UART).
   - Testes realizados (Wi-Fi, Ethernet, HDMI, USB, gravação na eMMC).

---

## 8. O que o CI do GitHub Actions Valida

Quando seu Pull Request é aberto, o pipeline de integração contínua (CI) executa os seguintes passos automáticos:

1. **Validação Estrutural de Schemas**:
   - Cada `device.yaml` é validado contra `schemas/device.schema.json` (Draft 2020-12).
   - Cada `images.yaml` é validado contra `schemas/image.schema.json`.
   - Cada arquivo em `vendors/` é validado contra `schemas/vendor.schema.json`.
2. **Checagem de Consistência e Chaves Estrangeiras**:
   - O campo `manufacturer` em `device.yaml` deve existir em `vendors/<manufacturer>.yaml`.
   - O campo `device_id` em `images.yaml` deve coincidir com o `id` em `device.yaml`.
3. **Integridade de Downloads e Checksums**:
   - As URLs de download e sha256 são testadas para garantir disponibilidade e cabeçalhos HTTP 200/302 válidos.
4. **Compilação do Catálogo**:
   - O script de build compila todos os dispositivos, imagens, fornecedores e fingerprints gerando o arquivo único `dist/catalog.json` validado contra `schemas/catalog.schema.json`.
