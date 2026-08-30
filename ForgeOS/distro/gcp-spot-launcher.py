#!/usr/bin/env python3
# ==============================================================================
# MultiForge — Google Cloud Spot VM (32 vCPUs) Distro Compiler & Launcher
# ==============================================================================
# Executa a compilação completa da distro ForgeOS em uma máquina spot efêmera
# de alta performance (32 vCPUs) e auto-destrói a VM assim que termina.
# Custo estimado: ~R$ 0,10 a 0,30 por compilação (menos de 5 minutos).
# ==============================================================================

import os
import sys
import time
import subprocess
import argparse

INSTANCE_NAME = "forgeos-builder-spot-32"
ZONE = "us-central1-a"
PROJECT = "stt-465818"
MACHINE_TYPE = "c2-standard-32"  # 32 vCPUs, 128 GB RAM
BOOT_DISK_SIZE = "60GB"
IMAGE_FAMILY = "ubuntu-2404-lts-amd64"
IMAGE_PROJECT = "ubuntu-os-cloud"

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DOWNLOADS_DIR = os.path.join(os.environ.get("USERPROFILE", r"C:\Users\Aluno"), "Downloads")
GCLOUD_CMD = os.path.join(os.environ.get("USERPROFILE", r"C:\Users\Aluno"), "google-cloud-sdk", "bin", "gcloud.cmd")
if not os.path.exists(GCLOUD_CMD):
    GCLOUD_CMD = "gcloud"


def log(msg):
    print(f"\033[1;34m[GCP-SPOT]\033[0m {msg}", flush=True)


def ok(msg):
    print(f"\033[1;32m[GCP-SPOT OK]\033[0m {msg}", flush=True)


def err(msg):
    print(f"\033[1;31m[GCP-SPOT ERROR]\033[0m {msg}", file=sys.stderr, flush=True)


def run_gcloud(args, check=True):
    cmd = [GCLOUD_CMD] + args + [f"--project={PROJECT}"]
    log(f"Executando: {' '.join(cmd)}")
    res = subprocess.run(cmd, text=True, capture_output=True)
    if res.returncode != 0 and check:
        err(f"Comando falhou com código {res.returncode}:\n{res.stderr}")
        raise RuntimeError(res.stderr)
    return res


def create_spot_vm():
    log(f"1. Criando Instância Spot 32 vCPUs ({MACHINE_TYPE}) na zona {ZONE}...")
    args = [
        "compute", "instances", "create", INSTANCE_NAME,
        f"--zone={ZONE}",
        f"--machine-type={MACHINE_TYPE}",
        "--provisioning-model=SPOT",
        "--instance-termination-action=DELETE",
        f"--boot-disk-size={BOOT_DISK_SIZE}",
        "--boot-disk-type=pd-ssd",
        f"--image-family={IMAGE_FAMILY}",
        f"--image-project={IMAGE_PROJECT}",
        "--scopes=cloud-platform",
        "--metadata=enable-oslogin=TRUE"
    ]
    run_gcloud(args)
    ok("Instância Spot criada com sucesso!")


def wait_for_ssh():
    log("2. Aguardando inicialização do SSH na VM (até 60s)...")
    for i in range(12):
        time.sleep(5)
        res = subprocess.run(
            [GCLOUD_CMD, "compute", "ssh", INSTANCE_NAME, f"--zone={ZONE}", f"--project={PROJECT}", "--command=echo ready", "--quiet"],
            capture_output=True, text=True
        )
        if "ready" in res.stdout:
            ok("SSH pronto e conectado!")
            return True
        print(".", end="", flush=True)
    print()
    return False


def build_and_download():
    log("3. Enviando código do MultiForge para a Spot VM...")
    # Compacta e envia via scp
    tar_path = os.path.join(os.environ.get("TEMP", r"C:\tmp"), "multiforge.tar.gz")
    os.makedirs(os.path.dirname(tar_path), exist_ok=True)
    
    log("Gerando arquivo de código...")
    subprocess.run(["tar", "-czf", tar_path, "-C", REPO_ROOT, "--exclude=.git", "--exclude=ForgeImager/node_modules", "."], check=True)
    
    log("Transferindo para a VM via gcloud scp...")
    run_gcloud(["compute", "scp", tar_path, f"{INSTANCE_NAME}:/tmp/multiforge.tar.gz", f"--zone={ZONE}", "--quiet"])
    
    log("4. Executando compilação paralela com 32 vCPUs na Spot VM...")
    remote_script = """
    set -e
    mkdir -p /root/multi-forge
    tar -xzf /tmp/multiforge.tar.gz -C /root/multi-forge
    chmod +x /root/multi-forge/ForgeOS/distro/build-image.sh
    OUTPUT_DIR=/root/distro_output /root/multi-forge/ForgeOS/distro/build-image.sh
    """
    
    res = subprocess.run(
        [GCLOUD_CMD, "compute", "ssh", INSTANCE_NAME, f"--zone={ZONE}", f"--project={PROJECT}", f"--command={remote_script}", "--quiet"],
        text=True
    )
    if res.returncode != 0:
        err("Erro na compilação dentro da Spot VM!")
        return False

    log("5. Baixando a imagem gerada (.img.xz e .sha256) para Downloads...")
    dest_dir = DOWNLOADS_DIR
    run_gcloud(["compute", "scp", f"{INSTANCE_NAME}:/root/distro_output/*", dest_dir, f"--zone={ZONE}", "--quiet"])
    ok(f"Arquivos baixados com sucesso para: {dest_dir}")
    return True


def delete_spot_vm():
    log(f"6. DESTRUINDO INSTÂNCIA SPOT {INSTANCE_NAME} (Economia 100%)...")
    subprocess.run(
        [GCLOUD_CMD, "compute", "instances", "delete", INSTANCE_NAME, f"--zone={ZONE}", f"--project={PROJECT}", "--quiet"],
        capture_output=True, text=True
    )
    ok("Instância deletada. Zero cobrança contínua!")


def main():
    parser = argparse.ArgumentParser(description="MultiForge GCP Spot VM 32 vCPU Builder")
    parser.add_argument("--project", default=PROJECT, help="ID do projeto GCP")
    parser.add_argument("--zone", default=ZONE, help="Zona GCP")
    parser.add_argument("--keep-vm", action="store_true", help="Não deletar a VM ao final (para debug)")
    args = parser.parse_args()

    global PROJECT, ZONE
    PROJECT = args.project
    ZONE = args.zone

    log(f"Iniciando Build de Alta Performance na GCP Spot (Projeto: {PROJECT}, Zona: {ZONE})...")
    try:
        create_spot_vm()
        if not wait_for_ssh():
            raise RuntimeError("Timeout esperando SSH na Spot VM.")
        success = build_and_download()
        if success:
            ok("BUILD FORGEOS CONCLUÍDO COM SUCESSO!")
        else:
            err("O build falhou.")
    finally:
        if not args.keep_vm:
            delete_spot_vm()
        else:
            log("VM mantida (--keep-vm ativo).")


if __name__ == "__main__":
    main()
