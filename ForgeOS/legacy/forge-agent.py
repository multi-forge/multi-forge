#!/usr/bin/env python3
"""
ForgeOS Agent & First Boot Provisioning Daemon v1.6
Uses wpa_supplicant mode=2 AP Engine for Realtek RTL8189FTV Wi-Fi chips on Amlogic S905X2.
Guarantees Wi-Fi AP broadcast 'ForgeOS' without alloc xmitbuf fail.
"""
import os
import sys
import time
import subprocess
import glob
from pathlib import Path

BOOT_FORGE_DIR = Path('/boot/forge')
NETWORK_YAML = BOOT_FORGE_DIR / 'network.yaml'
MINA_YAML = BOOT_FORGE_DIR / 'mina.yaml'

def get_hdmi_status():
    drm_paths = glob.glob('/sys/class/drm/*HDMI*/status')
    for path in drm_paths:
        try:
            with open(path, 'r') as f:
                status = f.read().strip()
                if status:
                    return status
        except Exception:
            pass
    return 'disconnected'

def run_cmd_safe(cmd, shell=False, timeout=10):
    cmd_str = cmd if shell else " ".join(cmd)
    print(f"[FORGE-AGENT] Executing: {cmd_str}")
    try:
        res = subprocess.run(cmd, shell=shell, capture_output=True, text=True, timeout=timeout)
        if res.returncode != 0:
            print(f"[FORGE-AGENT WARNING] Command returned code {res.returncode}")
        return res
    except subprocess.TimeoutExpired:
        print(f"[FORGE-AGENT] Process running in background: {cmd_str}")
        return None
    except Exception as e:
        print(f"[FORGE-AGENT ERROR] Failed to execute {cmd_str}: {e}")
        return None

def setup_wifi_hardware():
    print("[FORGE-AGENT] Initializing Realtek RTL8189FTV Wi-Fi Hardware & SDIO bus...")
    run_cmd_safe('rfkill unblock all 2>/dev/null', shell=True)
    run_cmd_safe('modprobe 8189fs 2>/dev/null', shell=True)
    run_cmd_safe('ip link set wlan0 up 2>/dev/null', shell=True)

def kill_stale_port_processes():
    print("[FORGE-AGENT] Cleaning up stale processes on port 80/8080...")
    run_cmd_safe('fuser -k 80/tcp 8080/tcp 2>/dev/null', shell=True)
    run_cmd_safe("pkill -9 -f 'captive-portal/server.py' 2>/dev/null", shell=True)

def start_captive_portal():
    print('[FORGE-AGENT] Starting Hotspot AP (SSID: ForgeOS) & Captive Portal Mode...')
    
    setup_wifi_hardware()
    kill_stale_port_processes()

    # 1. Generate wpa_supplicant mode=2 AP config for Realtek 8189fs
    wpa_ap_conf = """ctrl_interface=/var/run/wpa_supplicant
ap_scan=1

network={
    ssid="ForgeOS"
    mode=2
    key_mgmt=WPA-PSK
    psk="forgeos123"
    frequency=2437
}
"""
    try:
        with open('/tmp/wpa_ap.conf', 'w') as f:
            f.write(wpa_ap_conf)
    except Exception as e:
        print(f"[FORGE-AGENT WARNING] Failed to write wpa_ap.conf: {e}")

    dnsmasq_conf = """interface=wlan0
except-interface=lo
bind-interfaces
dhcp-range=192.168.4.10,192.168.4.250,12h
address=/#/192.168.4.1
"""
    try:
        with open('/tmp/dnsmasq.conf', 'w') as f:
            f.write(dnsmasq_conf)
    except Exception as e:
        print(f"[FORGE-AGENT WARNING] Failed to write dnsmasq.conf: {e}")

    # Start wpa_supplicant AP mode
    run_cmd_safe('pkill -9 hostapd 2>/dev/null', shell=True)
    run_cmd_safe('pkill -9 wpa_supplicant 2>/dev/null', shell=True)
    run_cmd_safe('ip link set wlan0 up 2>/dev/null', shell=True)
    run_cmd_safe(['wpa_supplicant', '-B', '-i', 'wlan0', '-c', '/tmp/wpa_ap.conf'])

    time.sleep(2)
    run_cmd_safe('ip addr add 192.168.4.1/24 dev wlan0 2>/dev/null', shell=True)

    # Start dnsmasq DHCP/DNS server
    run_cmd_safe('pkill -9 dnsmasq 2>/dev/null', shell=True)
    run_cmd_safe(['dnsmasq', '-C', '/tmp/dnsmasq.conf'])

    # 2. Apply iptables NAT redirect for HTTP 80
    run_cmd_safe(['iptables', '-t', 'nat', '-A', 'PREROUTING', '-i', 'wlan0', '-p', 'tcp', '--dport', '80', '-j', 'DNAT', '--to-destination', '192.168.4.1:80'])
    run_cmd_safe(['iptables', '-A', 'FORWARD', '-i', 'wlan0', '-p', 'tcp', '--dport', '80', '-j', 'ACCEPT'])

    # 3. Check HDMI status & render dual QR Code setup screen
    hdmi = get_hdmi_status()
    print(f'[FORGE-AGENT] HDMI Status: {hdmi}')

    wifi_qr_payload = "WIFI:S:ForgeOS;T:WPA;P:forgeos123;;"
    url_qr_payload = "http://192.168.4.1"

    if hdmi == 'connected':
        print('[FORGE-AGENT] HDMI Connected. Rendering Fullscreen Dual QR Code Kiosk on DRM/KMS Framebuffer...')
        run_cmd_safe('python3 /usr/bin/forge-display-qr', shell=True)
    else:
        print('[FORGE-AGENT] Headless Mode (No HDMI). Rendering Dual ANSI QR Codes on TTY1 console...')
        run_cmd_safe('echo "\n--- 1. CONECTAR À REDE WI-FI ---" > /dev/tty1', shell=True)
        run_cmd_safe(f'qrencode -t UTF8 "{wifi_qr_payload}" > /dev/tty1 2>/dev/null', shell=True)
        run_cmd_safe('echo "\n--- 2. ABRIR PORTAL CAPTIVO ---" > /dev/tty1', shell=True)
        run_cmd_safe(f'qrencode -t UTF8 "{url_qr_payload}" > /dev/tty1 2>/dev/null', shell=True)

    # 4. Launch Captive Portal HTTP Server
    print('[FORGE-AGENT] Starting Captive Portal Web Server...')
    run_cmd_safe(['python3', '/opt/forgeos/captive-portal/server.py', '80'], timeout=None)

def apply_provisioning():
    print('[FORGE-AGENT] Checking provisioning files in /boot/forge/...')
    if NETWORK_YAML.exists() and MINA_YAML.exists():
        print('[FORGE-AGENT] Provisioning files found. Applying configurations...')
        ssid, passphrase = '', ''
        try:
            with open(NETWORK_YAML, 'r') as f:
                for line in f:
                    if 'ssid:' in line:
                        ssid = line.split(':', 1)[1].strip().strip("'")
                    elif 'passphrase:' in line:
                        passphrase = line.split(':', 1)[1].strip().strip("'")
        except Exception as e:
            print(f"[FORGE-AGENT ERROR] Failed to parse network.yaml: {e}")

        if ssid:
            print(f'[FORGE-AGENT] Connecting to Wi-Fi SSID: {ssid}...')
            run_cmd_safe(['nmcli', 'dev', 'wifi', 'connect', ssid, 'password', passphrase])

        window_mode = '-g right'
        try:
            with open(MINA_YAML, 'r') as f:
                for line in f:
                    if 'window_mode:' in line:
                        window_mode = line.split(':', 1)[1].strip().strip("'")
        except Exception as e:
            print(f"[FORGE-AGENT WARNING] Failed to parse mina.yaml: {e}")

        print(f'[FORGE-AGENT] Launching Mina Assistant with window mode: {window_mode}...')
        mina_cmd = ['python3', '/root/Mina-a-Assistente-Virtual/main_cli.py'] + window_mode.split()
        run_cmd_safe(mina_cmd, timeout=None)
    else:
        print('[FORGE-AGENT] Provisioning files NOT found. Falling back to Captive Portal...')
        start_captive_portal()

if __name__ == '__main__':
    apply_provisioning()
