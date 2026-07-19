<h2 align="center">
  🔧 Forge Imager
  <br><br>
</h2>

### About

Forge Imager is a tool for downloading and flashing OS images to single-board computers. It checks the target disk before writing, validates the checksum, and verifies the image after the write, so a bad download or the wrong disk doesn't turn into a broken card.

> **Note:** This project is a fork of [Armbian Imager](https://github.com/armbian/imager), adapted for the Forge ecosystem.

### Features

- Works with multiple boards, with filtering and board metadata
- Disk safety checks, checksum validation, and post-write verification
- Native builds for Linux, Windows, and macOS, on x64 and ARM64
- Multi-language interface that follows your system language by default
- Built-in application updates
- Small binary with few runtime dependencies

## Download

Prebuilt binaries are available for every supported platform.

| <a href="https://github.com/multi-forge/multi-forge/releases"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/apple.svg" width="24"><br><strong>macOS</strong></a> | <a href="https://github.com/multi-forge/multi-forge/releases"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/windows11.svg" width="24"><br><strong>Windows</strong></a> | <a href="https://github.com/multi-forge/multi-forge/releases"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linux.svg" width="24"><br><strong>Linux</strong></a> |
|:---:|:---:|:---:|
| Intel & Apple Silicon | x64 & ARM64 | x64 & ARM64 |
| <code>.dmg</code> / <code>.app.zip</code> | <code>.exe</code> / <code>.msi</code> | <code>.deb</code> / <code>.AppImage</code> |

## How It Works

1. **Pick a manufacturer.** Choose one of the supported SBC vendors, or load your own image file.
2. **Pick a board.** Boards show photos and metadata.
3. **Pick an image.** Desktop or server, a kernel branch, and a stable, nightly, or rolling release build.
4. **Flash.** The app downloads, decompresses, writes, and verifies for you.

## Customization

- Theme: light, dark, or follow the system setting
- Developer mode: turn on detailed logging and open the log viewer
- Language: 18 languages, auto-detected from your system

## Platform Support

| Platform | Architecture | Notes |
|----------|-------------|-------|
| macOS | Intel x64 | Full support |
| macOS | Apple Silicon | Native ARM64 build, Touch ID support |
| Windows | x64 | Requires Administrator privileges |
| Windows | ARM64 | Native ARM64 build, requires Administrator privileges |
| Linux | x64 | Uses lsblk for detection and UDisks2/polkit for elevated device access |
| Linux | ARM64 | Native ARM64 build |

### Supported Languages

English, Italian, German, French, Spanish, Portuguese, Portuguese (Brazil), Dutch, Polish, Russian, Chinese, Japanese, Korean, Ukrainian, Turkish, Slovenian, Swedish, Croatian

## Development

Setup, build instructions, and project layout live in [DEVELOPMENT.md](DEVELOPMENT.md).

## Credits

- Based on [Armbian Imager](https://github.com/armbian/imager) — original project
- [Tauri](https://tauri.app/) — Framework
- [i18next](https://www.i18next.com/) — Internationalization
- [Lucide](https://lucide.dev/) — Icons

---

<p align="center">
  <sub>Made with ❤️ by the Forge community</sub>
</p>
