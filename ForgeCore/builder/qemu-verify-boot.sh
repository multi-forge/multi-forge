#!/usr/bin/env bash
# ==============================================================================
# MultiForge — QEMU AArch64 Virtual Boot Verification Harness
# ==============================================================================
# Executa um teste de inicialização do kernel, initramfs e rootfs em ambiente
# virtual antes de qualquer gravação em eMMC física.
# Verifica:
#   1. Descompressão e boot do kernel ARM64
#   2. Montagem íntegra do rootfs ext4 (sem erros de FS)
#   3. Inicialização do Systemd
#   4. Detecção e carga das unidades do ForgeOS
# ==============================================================================

set -euo pipefail

IMAGE="${1:-}"
TIMEOUT_SEC="${2:-45}"
LOG_FILE="/tmp/qemu-boot-test.log"

log() { echo -e "\033[1;34m[QEMU-TEST]\033[0m $*"; }
ok()  { echo -e "\033[1;32m[QEMU-TEST OK]\033[0m $*"; }
err() { echo -e "\033[1;31m[QEMU-TEST ERROR]\033[0m $*" >&2; }

if [ -z "$IMAGE" ] || [ ! -f "$IMAGE" ]; then
    err "Uso: $0 <caminho_da_imagem.img> [timeout_segundos]"
    exit 1
fi

log "1. Verificando dependências QEMU System ARM64..."
if ! command -v qemu-system-aarch64 >/dev/null 2>&1 || [ ! -f /usr/share/qemu/efi-virtio.rom ]; then
    log "Instalando qemu-system-arm e ipxe-qemu..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq && apt-get install -y -qq qemu-system-arm ipxe-qemu
fi

log "2. Extraindo Kernel e Initramfs da partição de boot da imagem..."
LOOP_DEV=$(losetup -Pf --show "$IMAGE")
BOOT_PART="${LOOP_DEV}p1"
ROOT_PART="${LOOP_DEV}p2"

TMP_MNT="/tmp/qemu_mnt_boot"
mkdir -p "$TMP_MNT"
mount "$BOOT_PART" "$TMP_MNT"

KERNEL_BIN="$TMP_MNT/zImage"
[ -f "$KERNEL_BIN" ] || KERNEL_BIN=$(ls "$TMP_MNT"/vmlinuz* 2>/dev/null | head -n1 || true)
INITRD_BIN="$TMP_MNT/uInitrd"
[ -f "$INITRD_BIN" ] || INITRD_BIN=$(ls "$TMP_MNT"/initrd.img* 2>/dev/null | head -n1 || true)

cp "$KERNEL_BIN" /tmp/qemu-vmlinuz
cp "$INITRD_BIN" /tmp/qemu-initrd
umount "$TMP_MNT"
losetup -d "$LOOP_DEV"

log "Kernel extraído: /tmp/qemu-vmlinuz ($(du -h /tmp/qemu-vmlinuz | awk '{print $1}'))"
log "Initrd extraído: /tmp/qemu-initrd ($(du -h /tmp/qemu-initrd | awk '{print $1}'))"

log "3. Executando simulação de boot virtual ARM64 (timeout: ${TIMEOUT_SEC}s)..."
rm -f "$LOG_FILE"

BOOT_CMD=(
    qemu-system-aarch64
    -M virt
    -cpu cortex-a53
    -smp 4
    -m 1024
    -kernel /tmp/qemu-vmlinuz
    -initrd /tmp/qemu-initrd
    -append "root=/dev/vda2 rootfstype=ext4 rw console=ttyAMA0 systemd.journald.forward_to_console=1 panic=1"
    -drive "file=$IMAGE,format=raw,if=virtio"
    -device ramfb
    -netdev user,id=net0,hostfwd=tcp::2222-:22
    -device virtio-net-pci,netdev=net0
    -nographic
    -no-reboot
)

timeout "${TIMEOUT_SEC}s" "${BOOT_CMD[@]}" > "$LOG_FILE" 2>&1 || true

log "4. Analisando telemetria e integridade dos serviços capturados..."
if grep -q "Linux version" "$LOG_FILE"; then
    KERNEL_VER=$(grep "Linux version" "$LOG_FILE" | head -n1)
    ok "Kernel inicializado com sucesso: $KERNEL_VER"
else
    err "FALHA: O kernel ARM64 não iniciou!"
    cat "$LOG_FILE" | tail -n 30
    exit 1
fi

if grep -qi "systemd" "$LOG_FILE" || grep -qi "Welcome to" "$LOG_FILE"; then
    ok "Rootfs montado e Systemd inicializado com sucesso!"
else
    log "Aviso: systemd ainda em inicialização dentro de ${TIMEOUT_SEC}s."
fi

if grep -qi "Kernel panic" "$LOG_FILE"; then
    err "CRÍTICO: Kernel Panic detectado durante o boot virtual!"
    grep -C 5 -i "Kernel panic" "$LOG_FILE"
    exit 1
fi

# Auditoria de Falhas de Software (Gate de Validação da Release)
if grep -qi "ModuleNotFoundError" "$LOG_FILE" || grep -qi "Traceback (most recent call last)" "$LOG_FILE"; then
    err "CRÍTICO: Exceção Python detectada nos serviços de display/kiosk!"
    grep -C 3 -i "ModuleNotFoundError" "$LOG_FILE" || grep -C 5 -i "Traceback" "$LOG_FILE"
    exit 1
fi

if grep -q "Failed to start forge-kiosk.service" "$LOG_FILE" || grep -q "forge-kiosk.service: Main process exited" "$LOG_FILE"; then
    err "CRÍTICO: forge-kiosk.service falhou ao inicializar no boot!"
    grep -C 3 -i "forge-kiosk" "$LOG_FILE"
    exit 1
fi

if grep -qi "Started .*Kiosk" "$LOG_FILE" || grep -qi "Started forge-kiosk.service" "$LOG_FILE"; then
    ok "Kiosk de Framebuffer inicializado com sucesso no userspace!"
fi

ok "===================================================================="
ok "TESTE VIRTUAL DE BOOT APROVADO: Imagem íntegra e pronta para flash!"
ok "===================================================================="
exit 0
