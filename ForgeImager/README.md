# ForgeImager

Ferramenta desktop oficial do ecossistema MultiForge para identificacao automatica de hardware, download, customizacao e gravacao de sistemas operacionais em computadores de placa unica (SBCs) e TV Boxes (Amlogic, Qualcomm, Rockchip, Allwinner).

Desenvolvido em **Tauri v2, React 19 e Rust**, combinando backend nativo de alta performance com interface grafica modular.

---

## Como o Sistema Funciona

O ForgeImager opera atraves de quatro subsistemas integrados:

```text
+-------------------------------------------------------------------------+
|                              ForgeImager                                |
|                                                                         |
|  [ Interface React 19 ] <--- IPC (Tauri v2) ---> [ Backend Rust Nativo ]|
|          |                                                |             |
|          v                                                v             |
|   Selecao Manual /                                 Autodeteccao         |
|   Deteccao Visual                                  via Fingerprints     |
|          |                                                |             |
+----------|------------------------------------------------|-------------+
           |                                                |
           v                                                v
   [ ForgeDB (CDN jsDelivr) ]                    [ Win32 IOCTL / UDisks2 ]
   - Catalogo compilado                          - Leitura de PhysicalDrive
   - Fingerprints de hardware                    - Capacidade e barramento
   - Metadados de SO e imagens                   - Vendor ID / Product ID
```

### 1. Integracao com ForgeDB e Catalogo Dinamico

O aplicativo nao possui placas ou imagens fixadas no codigo-fonte. Em vez disso, ele consulta o ForgeDB de forma dinamica atraves de uma cascata de fontes:

1. **CDN Global jsDelivr:** Carrega `catalog.min.json` diretamente do branch principal do repositorio, sem custo e sem limite de requisicoes.
2. **GitHub Pages:** Segundo nivel de contingencia para o catalogo compilado.
3. **GitHub Raw:** Terceiro nivel de contingencia.
4. **Cache Local em Disco:** Armazena localmente a ultima versao valida do catalogo para permitir uso offline.
5. **Catalogo Embutido (Fallback):** Snapshot estatico compilado diretamente dentro do binario Rust para garantir funcionamento em primeiro boot sem internet.

### 2. Autodeteccao de Dispositivos por Fingerprints

Ao conectar uma TV Box, cartao SD ou pendrive, o backend nativo analisa os identificadores de baixo nivel do hardware e compara com as assinaturas cadastradas no ForgeDB:

- **Assinatura de Armazenamento (Storage Model):** Casamento por padroes glob sobre o nome do modelo retornado pelas chamadas de IOCTL (ex: `*S905X2*`, `*BTV*E10*`, `*SEI510*`).
- **Identificadores USB (VID/PID):** Deteccao de chips em modo de recuperacao (MaskROM / EDL / Sahara).
- **Faixa de Capacidade:** Validacao heuristica do tamanho de memoria flash declarada para o modelo.
- **Assinatura Device Tree (Linux):** Leitura de `/proc/device-tree/compatible` para placas rodando sob ambiente Linux.

Quando uma correspondencia atinge a pontuacao minima de confianca, o ForgeImager pre-seleciona a fabricante, a placa e a imagem recomendada, exibindo o status de autodeteccao na interface.

### 3. Pipeline de Gravacao e Descompressao

- **Streaming com Descompressao em Tempo Real:** Suporte a arquivos `.xz` (multi-thread via `lzma-rust2`), `.gz`, `.zst` e `.bz2`.
- **Verificacao Criptografica SHA-256:** Validacao do fluxo de dados com deteccao antecipada de corrupcao.
- **Injecao Userspace Ext4 (`crates/forge-write-conf`):** Gravacao direta de arquivos de autoconfiguracao (credenciais Wi-Fi, usuario, layout de teclado) dentro da particao ext4 de destino sem exigir montagem de sistema de arquivos no sistema operacional hospedeiro.
- **Gravacao Qualcomm EDL (Modo Sahara):** Comunicacao nativa com dispositivos Qualcomm via protocolo Firehose (`VID 0x05C6`, `PID 0x9008`).

---

## Estrutura do Codigo

```text
ForgeImager/
|-- src/                              # Frontend React 19 + TypeScript
|   |-- App.tsx                       # Fluxo principal e maquina de estados
|   |-- components/                   # Modais, selecao de placas, barra de progresso
|   |-- hooks/                        # Hooks IPC para comunicacao com o Tauri
|   `-- locales/                      # Arquivos de internacionalizacao (18 idiomas)
|-- src-tauri/                        # Backend Rust
|   |-- src/
|   |   |-- main.rs                  # Ponto de entrada e registro de comandos IPC
|   |   |-- forgedb/                 # Modulo de integracao com ForgeDB
|   |   |   |-- catalog.rs           # Cascata de busca (jsDelivr, Pages, Cache)
|   |   |   |-- fingerprint.rs       # Algoritmo de matching e autodeteccao
|   |   |   `-- models.rs            # Estruturas de dados do catalogo
|   |   |-- commands/                # 56 comandos IPC expostos ao React
|   |   |   |-- forgedb.rs           # Comandos de autodeteccao e status
|   |   |   |-- board_queries.rs     # Consulta de fabricantes e placas
|   |   |   |-- operations.rs        # Download, descompressao e gravacao
|   |   |   `-- state.rs             # Estado global da aplicacao em memoria
|   |   |-- devices/                 # Enumeracao de discos por plataforma
|   |   |   |-- windows.rs           # Win32 IOCTLs (PhysicalDrive0-31)
|   |   |   |-- linux.rs             # lsblk + sysfs
|   |   |   `-- macos.rs             # DiskArbitration framework
|   |   `-- qdl/                     # Modulo Qualcomm EDL / Sahara
|   |-- forgedb_builtin.json         # Snapshot do catalogo embutido no binario
|   `-- Cargo.toml                   # Dependencias Rust
`-- crates/
    `-- forge-write-conf/            # Injetor ext4 sem montagem de disco
```

---

## Compatibilidade por Plataforma

| Plataforma | Metodo de Enumeracao | Metodo de Gravacao | Privilegios |
|------------|----------------------|--------------------|-------------|
| Windows | Win32 IOCTL (`\\.\PhysicalDrive`) | `CreateFileW` com `FILE_FLAG_WRITE_THROUGH` | Exige Administrador |
| Linux | `lsblk` JSON + sysfs | UDisks2 file descriptor / direct I/O | Polkit transparente |
| macOS | DiskArbitration FFI | `authopen` direto em `/dev/rdisk*` | Touch ID / Security.framework |

---

## Como Executar e Compilar

### Pre-requisitos
- Node.js >= 20.19.0 e npm >= 10
- Rust Toolchain (rustc >= 1.85.0)
- Visual Studio Build Tools 2022 (Windows) ou ferramentas nativas C (Linux/macOS)
- WebView2 Runtime (Windows)

### Comandos de Desenvolvimento

```bash
cd ForgeImager

# Instalar dependencias do frontend:
npm install

# Iniciar servidor de desenvolvimento (React + Rust com hot-reload):
npm run tauri:dev

# Compilar versao de depuracao rapida:
npm run tauri:build:dev

# Compilar pacote final de producao (NSIS .exe e .msi com LTO):
npm run tauri:build
```

---

## Licenca

Distribuido sob licenca MIT. Consulte o arquivo [LICENSE](../LICENSE) na raiz do projeto.
