# 🗄️ ForgeDB

**ForgeDB** é a base de dados centralizada e fonte única da verdade (*single source of truth*) para hardware **e** módulos do ecossistema MultiForge/ForgeOS.

## Visão Geral

O ForgeDB armazena metadados estruturados em YAML/JSON que descrevem:

- **Dispositivos de hardware** — specs, SoC, boot, imagens de SO e problemas conhecidos
- **Módulos de software** — dependências, lifecycle, variantes de deploy e compatibilidade

Todas as ferramentas do ecossistema (Forge Agent, Forge Installer, Forge CLI) consomem estes dados para automação de instalação, verificação de compatibilidade e provisionamento.

## Estrutura

```
ForgeDB/
├── README.md                         # ← Este arquivo
├── devices/                          # Descritores de hardware
│   └── {manufacturer}/
│       └── {model}/
│           ├── device.yaml           # Specs, boot config, imagens
│           ├── images.yaml           # Catálogo de imagens de SO
│           ├── docs/                 # Documentação do dispositivo
│           ├── photos/               # Fotos do hardware
│           └── revisions/            # Revisões de hardware
├── modules/                          # Manifestos de módulos de software
│   ├── catalog.yaml                  # Catálogo central de todos os módulos
│   ├── {module-id}/
│   │   └── module.yaml              # Manifesto individual do módulo
├── images/                           # Assets compartilhados
└── schemas/                          # Schemas de validação
    ├── device.schema.json            # JSON Schema para device.yaml
    └── module.schema.json            # JSON Schema para module.yaml
```

## Dispositivos (`devices/`)

Cada dispositivo suportado possui um diretório próprio organizado por fabricante e modelo.

O arquivo principal `device.yaml` segue o schema `forgedb/v1` e contém:

| Seção | Descrição |
|---|---|
| `hardware.soc` | Fabricante, modelo e arquitetura do SoC |
| `hardware.memory` | RAM e armazenamento |
| `hardware.wireless` | Chipset Wi-Fi/Bluetooth |
| `boot` | DTB, autoscript, ferramenta de instalação |
| `images` | Imagens de SO disponíveis para download |
| `known_issues` | Problemas conhecidos e soluções |

**Exemplo:** `devices/btv/e10/device.yaml` — BTV E10 com Amlogic S905X2

## Módulos (`modules/`)

Cada módulo do ForgeOS possui um manifesto `module.yaml` que descreve:

| Seção | Descrição |
|---|---|
| Metadados | ID, nome, versão, categoria, autor, licença |
| `requirements` | RAM mínima, Python, pacotes de sistema e pip |
| `source` | Tipo e caminho do código-fonte |
| `lifecycle` | Comandos de install, start, stop, healthcheck |
| `variants` | Variantes de deploy (Docker completo vs SQLite local) |
| `conflicts_with` | Módulos incompatíveis |

### Módulos Registrados

| ID | Nome | Categoria | Tier |
|---|---|---|---|
| `totem` | Mina — Assistente Virtual Acadêmica | AI | stable |
| `web-scraping` | Coletor Acadêmico & RAG Agent | Data | beta |

O arquivo `catalog.yaml` lista todos os módulos disponíveis com metadados resumidos.

## Schemas (`schemas/`)

Schemas JSON Draft 2020-12 para validação automatizada:

- **`device.schema.json`** — valida arquivos `device.yaml`
- **`module.schema.json`** — valida arquivos `module.yaml`

### Validação Local

```bash
# Instalar validador
pip install jsonschema pyyaml

# Validar um device.yaml
python -c "
import yaml, json, jsonschema
with open('schemas/device.schema.json') as s:
    schema = json.load(s)
with open('devices/btv/e10/device.yaml') as d:
    data = yaml.safe_load(d)
jsonschema.validate(data, schema)
print('✅ Valid!')
"
```

## Convenções

- **Caminhos** são sempre relativos à raiz do repositório `multi-forge/`
- **IDs** usam lowercase com hífens (`web-scraping`, não `WebScraping`)
- **Versões** seguem [Semantic Versioning](https://semver.org/)
- Arquivos YAML usam indentação de 2 espaços
- Módulos que compartilham recursos (portas, GPIO, etc.) devem declarar `conflicts_with`

## Contribuindo

1. Adicione um diretório para o novo dispositivo/módulo
2. Crie o `device.yaml` ou `module.yaml` seguindo o schema correspondente
3. Valide contra o JSON Schema antes de submeter
4. Atualize `modules/catalog.yaml` se adicionando um módulo novo
