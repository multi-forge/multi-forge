<h2 align="center">
  🔧 ForgeImager
  <br><br>
</h2>

### Sobre

O **ForgeImager** é a ferramenta desktop oficial do ecossistema MultiForge para download, parametrização e gravação segura de sistemas operacionais em computadores de placa única (SBCs) e TV Boxes reaproveitadas (Amlogic, Rockchip, Allwinner).

Construído com **Tauri v2 + React 19 + Rust**, combina a leveza e velocidade de um backend nativo em Rust com uma interface de usuário moderna, responsiva e com identidade visual 3D MultiForge.

### 🌟 Principais Recursos

- **Injeção Userspace em Ext4 (`crates/forge-write-conf`):** Injeta credenciais de Wi-Fi, usuários e scripts de primeiro boot diretamente na partição ext4 do disco de destino sem necessidade de montar (`mount`) ou privilégios de root do host.
- **Catálogo Dinâmico via GitHub Releases:** Integração direta com manifestos remotos (`release_assets/forge-images.json`) para download transparente de imagens oficiais e verificação SHA256.
- **Gravação Segura e Verificação em Tempo Real:** Suporte a streaming com descompressão multithread (`.xz`, `.gz`, `.zst`, `.bz2`) e checagem de integridade SHA-256 bloco a bloco.
- **Suporte de Emergência Qualcomm EDL / QDL:** Protocolo Sahara/Firehose integrado (`VID 0x05C6`) para recuperação de placas brickadas.
- **Identidade Visual 3D MultiForge:** Tema industrial com suporte a Dark, Light e sincronização com o SO.
- **Compilações Nativas Multiplataforma:** Linux, Windows e macOS (suportando x64 e ARM64).
- **Interface Multilíngue:** 18 idiomas suportados com detecção automática.

## 📦 Download

Binários pré-compilados estão disponíveis na aba [Releases](https://github.com/multi-forge/multi-forge/releases).

| <a href="https://github.com/multi-forge/multi-forge/releases"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/apple.svg" width="24"><br><strong>macOS</strong></a> | <a href="https://github.com/multi-forge/multi-forge/releases"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/windows11.svg" width="24"><br><strong>Windows</strong></a> | <a href="https://github.com/multi-forge/multi-forge/releases"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linux.svg" width="24"><br><strong>Linux</strong></a> |
|:---:|:---:|:---:|
| Intel e Apple Silicon | x64 e ARM64 | x64 e ARM64 |
| <code>.dmg</code> / <code>.app.zip</code> | <code>.exe</code> / <code>.msi</code> | <code>.deb</code> / <code>.AppImage</code> |

## Como Funciona

1. **Escolha um fabricante.** Selecione um dos fabricantes de SBC suportados ou carregue seu próprio arquivo de imagem local.
2. **Escolha uma placa.** As placas mostram fotos e metadados descritivos.
3. **Escolha uma imagem.** Selecione desktop ou servidor, ramificação do kernel e se deseja uma compilação estável, nightly ou rolling release.
4. **Grave.** O aplicativo baixa, descompacta, grava e verifica tudo de forma automatizada.

## Customização

- Tema: claro, escuro ou automático (seguindo a configuração do sistema)
- Modo desenvolvedor: ativa logs detalhados e abre o visualizador de logs integrado
- Idioma: 18 idiomas suportados, detectados automaticamente com base no seu sistema

## Suporte de Plataforma

| Plataforma | Arquitetura | Notas |
|------------|-------------|-------|
| macOS | Intel x64 | Suporte completo |
| macOS | Apple Silicon | Compilação ARM64 nativa, suporte a Touch ID |
| Windows | x64 | Requer privilégios de Administrador |
| Windows | ARM64 | Compilação ARM64 nativa, requer privilégios de Administrador |
| Linux | x64 | Usa lsblk para detecção de discos e UDisks2/polkit para acesso elevado ao dispositivo |
| Linux | ARM64 | Compilação ARM64 nativa |

### Idiomas Suportados

Alemão, Chinês, Coreano, Croata, Espanhol, Francês, Holandês, Inglês, Italiano, Japonês, Polonês, Português, Português (Brasil), Russo, Sueco, Esloveno, Turco, Ucraniano

## 🛠️ Desenvolvimento & Compilação

### Scripts Rápidos (Windows)
```bash
# Iniciar em modo desenvolvimento com hot-reload (Frontend + Rust IPC):
.\start-dev.bat

# Compilar binários de produção (.msi / .exe):
.\build.bat

# Executar binário compilado:
.\start-app.bat
```

### Compilação Manual (Cross-platform)
```bash
# 1. Instalar dependências do Frontend
pnpm install

# 2. Executar em modo desenvolvimento
pnpm tauri dev

# 3. Gerar instaladores de produção
pnpm tauri build
```

As instruções detalhadas de configuração de ambiente Rust/Node e arquitetura interna de IPC estão em [DEVELOPMENT.md](DEVELOPMENT.md).

## Créditos

- Baseado no [Armbian Imager](https://github.com/armbian/imager) — projeto original
- [Tauri](https://tauri.app/) — Framework de desenvolvimento
- [i18next](https://www.i18next.com/) — Internacionalização e traduções
- [Lucide](https://lucide.dev/) — Pacote de ícones

---

<p align="center">
  <sub>Feito com ❤️ pela comunidade Forge</sub>
</p>
