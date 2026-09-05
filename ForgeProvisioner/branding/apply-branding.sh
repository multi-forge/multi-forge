#!/bin/bash
# apply-branding.sh — aplica a identidade ForgeOS no device (executar como root,
# chamado pelo install.sh). Idempotente: pode rodar de novo sem duplicar nada.
#
#   apply-branding.sh [--src DIR] [--hostname NOME] [--keep-hostname] [--keep-armbian-motd]
#
# O que faz:
#   1. instala /opt/forgeos/branding/forge-banner (via install.sh) e o fragmento
#      /etc/update-motd.d/05-forge-banner (banner dinâmico a cada login SSH);
#   2. silencia os fragmentos *armbian* do update-motd.d (backup antes);
#   3. aposenta o /etc/motd estático do Armbian (backup antes);
#   4. instala /etc/issue + /etc/issue.net próprios;
#   5. instala /etc/forgeos-release (identidade) e ajusta hostname (padrão
#      forgeos-e10) + /etc/hosts;
#   6. ativa Banner /etc/issue.net no sshd via drop-in, só com `sshd -t` limpo.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
HOSTNAME_NEW="forgeos-e10"
KEEP_HOSTNAME=0
KEEP_ARMBIAN_MOTD=0

while [ $# -gt 0 ]; do
    case "$1" in
        --src) SRC="$2"; shift 2 ;;
        --hostname) HOSTNAME_NEW="$2"; shift 2 ;;
        --keep-hostname) KEEP_HOSTNAME=1; shift ;;
        --keep-armbian-motd) KEEP_ARMBIAN_MOTD=1; shift ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        *) echo "[BRANDING] opção desconhecida: $1" >&2; exit 1 ;;
    esac
done

if [ "$(id -u)" -ne 0 ]; then
    echo "[BRANDING] ERRO: rode como root" >&2
    exit 1
fi

BACKUP="/var/backups/forge-branding"
mkdir -p "$BACKUP"
log() { echo "[BRANDING] $*"; }

# --- 1. fragmento MOTD ---------------------------------------------------------
install -m 0755 -D /dev/stdin /etc/update-motd.d/05-forge-banner <<'FRAG'
#!/bin/sh
# ForgeOS login banner (gerenciado por ForgeOS branding; nao editar).
if [ -x /opt/forgeos/branding/forge-banner ]; then
    /opt/forgeos/branding/forge-banner
fi
FRAG
chmod 0755 /etc/update-motd.d/05-forge-banner
log "fragmento MOTD instalado em /etc/update-motd.d/05-forge-banner"

# --- 2. silencia fragmentos legados (armbian, ap-info, ip-info, etc.) -------
if [ "$KEEP_ARMBIAN_MOTD" -eq 0 ] && [ -d /etc/update-motd.d ]; then
    for f in /etc/update-motd.d/*armbian* /etc/update-motd.d/00-clear /etc/update-motd.d/15-ap-info /etc/update-motd.d/20-ip-info /etc/update-motd.d/25-containers-info /etc/update-motd.d/41-commands /etc/update-motd.d/99-blank; do
        [ -e "$f" ] || continue
        [ -x "$f" ] || continue
        cp -n "$f" "$BACKUP/" 2>/dev/null || true
        chmod -x "$f"
        log "fragmento legado silenciado: $f (backup em $BACKUP)"
    done
fi

# --- 3. aposenta /etc/motd estático ---------------------------------------------
if [ -s /etc/motd ]; then
    cp -n /etc/motd "$BACKUP/motd.armbian" 2>/dev/null || true
    rm -f /etc/motd
    log "/etc/motd do Armbian aposentado (backup em $BACKUP/motd.armbian)"
fi

# --- 4. issue / issue.net -------------------------------------------------------
if [ -f "$SRC/issue" ]; then
    for target in /etc/issue /etc/issue.net; do
        if [ -f "$target" ]; then
            cp -n "$target" "$BACKUP/$(basename "$target").armbian" 2>/dev/null || true
        fi
        cp "$SRC/issue" "$target"
    done
    log "/etc/issue e /etc/issue.net instalados"
fi

# --- 5. identidade + hostname ----------------------------------------------------
if [ -f "$SRC/forgeos-release" ]; then
    install -m 0644 "$SRC/forgeos-release" /etc/forgeos-release
    log "/etc/forgeos-release instalado"
fi

if [ "$KEEP_HOSTNAME" -eq 0 ]; then
    CUR="$(hostname)"
    if [ "$CUR" != "$HOSTNAME_NEW" ]; then
        if command -v hostnamectl >/dev/null 2>&1; then
            hostnamectl set-hostname "$HOSTNAME_NEW"
        else
            echo "$HOSTNAME_NEW" > /etc/hostname
            hostname "$HOSTNAME_NEW"
        fi
        if grep -q '^127\.0\.1\.1' /etc/hosts 2>/dev/null; then
            sed -i "s/^127\.0\.1\.1.*/127.0.1.1\t$HOSTNAME_NEW/" /etc/hosts
        else
            printf '127.0.1.1\t%s\n' "$HOSTNAME_NEW" >> /etc/hosts
        fi
        log "hostname: $CUR -> $HOSTNAME_NEW"
    else
        log "hostname já é $HOSTNAME_NEW"
    fi
fi

# --- 6. limpeza de banner pré-autenticação redundante no sshd -------------
if [ -f /etc/ssh/sshd_config.d/60-forge-branding.conf ]; then
    rm -f /etc/ssh/sshd_config.d/60-forge-branding.conf
    if systemctl is-active --quiet ssh 2>/dev/null; then
        systemctl try-restart ssh || true
    elif systemctl is-active --quiet sshd 2>/dev/null; then
        systemctl try-restart sshd || true
    fi
    log "banner pré-autenticação redundante removido do sshd (MOTD dinâmico ativo)"
fi

log "concluído"
