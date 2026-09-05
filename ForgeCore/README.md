# ForgeCore

Núcleo do sistema operacional, árvore de dispositivos (Device Tree Blobs), otimizações de kernel, pipeline de compilação da distribuição e testes virtuais de boot com QEMU ARM64.

---

## 🎯 Arquitetura do Sistema

O **ForgeCore** é responsável pela camada de baixo nível do MultiForge:

1. **Kernel & Otimizações:** Base Linux 6.18.44-ophub com patches de alta performance:
   - **MGLRU (Multi-Gen LRU):** Otimização de gerenciamento de memória em placas de 2GB RAM.
   - **ZRAM ZSTD (50% de RAM):** Swap compactado ultra-rápido prevenindo desgaste prematuro da eMMC.
   - **TCP BBRv3 + FQ:** Controle moderno de congestionamento de rede com baixa latência.
   - **Fast-Path & Flow Offload:** Bypass de pilha de rede para throughput máximo.
2. **Device Trees (DTB Enterprise):**
   - `meson-g12a-btv-e10-enterprise.dtb`: Clock SDIO cravado em 25 MHz (estabilidade 100% no RTL8189FTV sem erros CRC), CMA reduzido para 64MB (+192MB RAM liberados) e Watchdog nativo do SoC Amlogic.
3. **Pipeline de Compilação de Imagens (.img.xz):**
   - `builder/build-image.sh`: Gera imagem oficial bootável e injeta a pilha do `ForgeProvisioner`.
   - `builder/gcp-spot-launcher.py`: Orquestrador em nuvem para compilar em Spot VMs (16 a 32 vCPUs) por fração de centavos.
4. **Verificação Virtual de Boot (QEMU AArch64):**
   - `builder/qemu-verify-boot.sh`: Simula a inicialização do kernel, initrd, montagem do rootfs e serviços systemd em máquina virtual ARM64 antes do flash em hardware real, garantindo risco ZERO de brick.

---

## 📁 Estrutura de Diretórios

```text
ForgeCore/
|-- builder/
|   |-- build-image.sh          # Pipeline principal de montagem da distro (.img.xz)
|   |-- gcp-spot-launcher.py    # Orquestrador de compilação em Spot VM (Google Cloud)
|   |-- qemu-verify-boot.sh     # Validador de boot virtual QEMU ARM64
|   `-- config/                 # Sysctl, modprobe e configurações de subsistemas
|-- dtb/
|   |-- meson-g12a-btv-e10-enterprise.dts # Código-fonte do Device Tree
|   `-- meson-g12a-btv-e10-enterprise.dtb # Blob compilado para boot
`-- docs/                       # Manuais de patches, tweaks e arquitetura
```

---

## 🛠️ Como Compilar

### 1. Na Nuvem (Google Cloud Spot VM - Recomendado)
```powershell
python ForgeCore/builder/gcp-spot-launcher.py --project=stt-465818 --zone=us-central1-a
```

### 2. Em Ambiente Local (Linux / WSL2)
```bash
sudo bash ForgeCore/builder/build-image.sh
```

### 3. Teste Virtual de Boot via QEMU
```bash
bash ForgeCore/builder/qemu-verify-boot.sh distro_output/ForgeOS_BTV_E10_v1.1.0.img 45
```
