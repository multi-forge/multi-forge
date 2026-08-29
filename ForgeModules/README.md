# 📦 MultiForge Modules (ForgeModules)

Diretório central das aplicações modulares que rodam sobre o **ForgeOS**. Cada módulo é uma aplicação independente com seu próprio manifesto declarativo (`module.yaml`), dependências e rotinas de ciclo de vida.

---

## 🧩 Módulos Disponíveis

| Módulo | Categoria | Descrição | Stack | Status |
|---|---|---|---|---|
| **[totem](totem/)** | AI / Voz | Mina — Assistente Virtual Acadêmica para quiosques com voz offline e GUI | Python 3, PyQt5, Sherpa-ONNX, PortAudio, SQLite | **Estável** (Fase 1) |
| **[web-scraping](sub-modulos/web-scraping/)** | Dados / RAG | Coletor assíncrono de dados acadêmicos com API FastAPI e agente LangChain | Python 3.12, FastAPI, PostgreSQL/SQLite, LangChain | **Beta** (Fase 1) |

---

## 📜 Contrato de Módulo (`module.yaml`)

Para que o **ForgeOS** e o **Module Hub** possam gerenciar uma aplicação, ela deve conter um arquivo `module.yaml` padronizado:

```yaml
id: meu-modulo
name: "Meu Módulo Inteligente"
version: "1.0.0"
description: "Descrição da funcionalidade do módulo"
category: ai # ai | data | display | iot | tools
icon: "🚀"
author: "Seu Nome ou Laboratório"
license: MIT

requirements:
  min_ram_mb: 512
  min_storage_mb: 300
  python: ">=3.9"
  system_packages:
    - build-essential
    - python3-dev

source:
  type: local # local ou git
  path: "ForgeModules/meu-modulo"

lifecycle:
  install: "python install.py"
  start: "python main.py"
  stop: "pkill -f main.py"
  healthcheck: "curl -f http://localhost:5000/health"
  systemd_unit: "forge-meu-modulo.service"

conflicts_with:
  - web-scraping # módulos concorrentes de alta demanda de RAM
```

---

## 🚀 Ciclo de Vida do Módulo (Lifecycle)

Os módulos são orquestrados diretamente pelo Portal do ForgeOS ou via linha de comando:

1. **Descoberta:** O ForgeOS lê o catálogo em `ForgeDB/modules/catalog.yaml` e os manifestos `module.yaml`.
2. **Instalação:** Executa o hook `lifecycle.install` para preparar dependências de sistema, compilar C bindings e configurar bancos de dados locais.
3. **Inicialização:** Aciona o hook `lifecycle.start` ou ativa a unit systemd correspondente (`systemctl start forge-<modulo>.service`).
4. **Monitoramento:** O Portal executa o comando `lifecycle.healthcheck` e coleta uso de CPU/RAM para exibir nos cards do painel.
5. **Parada / Remoção:** Executa `lifecycle.stop` e desregistra o estado do módulo.

---

## 🛠️ Como Adicionar um Novo Módulo

1. Crie o diretório em `ForgeModules/<novo-modulo>/`.
2. Adicione o arquivo `module.yaml` definindo requisitos, ciclo de vida e comandos.
3. Cadastre o módulo no catálogo central em `ForgeDB/modules/catalog.yaml`.
4. Valide a conformidade do manifesto contra o schema JSON:
   ```bash
   python -c "import yaml, json, jsonschema; jsonschema.validate(yaml.safe_load(open('ForgeModules/<novo-modulo>/module.yaml')), json.load(open('ForgeDB/schemas/module.schema.json')))"
   ```
