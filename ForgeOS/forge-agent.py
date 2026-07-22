#!/usr/bin/env python3
"""
ForgeOS Agent & First Boot Provisioning Daemon
Implements Obsidian Blueprint Architecture goals for BTV E10 (Amlogic S905X2).
Includes automatic port cleanup, command fallbacks, and error recovery.
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
            print(f"[FORGE-AGENT WARNING] Command returned non-zero code {res.returncode}: {res.stderr.strip()}")
        return res
    except Exception as e:
        print(f"[FORGE-AGENT ERROR] Failed to execute {cmd_str}: {e}")
        return None

def kill_stale_port_processes():
    print("[FORGE-AGENT] Cleaning up stale processes on port 80/8080...")
    run_cmd_safe('fuser -k 80/tcp 8080/tcp 2>/dev/null', shell=True)
    run_cmd_safe("pkill -9 -f 'captive-portal/server.py' 2>/dev/null", shell=True)

def start_captive_portal():
    print('[FORGE-AGENT] Starting Hotspot AP & Captive Portal Mode...')
    
    kill_stale_port_processes()

    # 1. Try hostapd & dnsmasq AP setup
    hostapd_conf = """interface=wlan0
driver=nl80211
ssid=ForgeOS-Setup-btve10
hw_mode=g
channel=6
auth_algs=1
wpa=2
wpa_passphrase=forgeos123
wpa_key_mgmt=WPA-PSK
"""
    try:
        with open('/tmp/hostapd.conf', 'w') as f:
            f.write(hostapd_conf)
    except Exception as e:
        print(f"[FORGE-AGENT WARNING] Failed to write hostapd conf: {e}")

    dnsmasq_conf = """interface=wlan0
dhcp-range=192.168.4.10,192.168.4.250,12h
address=/#/192.168.4.1
"""
    try:
        with open('/tmp/dnsmasq.conf', 'w') as f:
            f.write(dnsmasq_conf)
    except Exception as e:
        print(f"[FORGE-AGENT WARNING] Failed to write dnsmasq conf: {e}")

    # 2. Apply iptables NAT redirect for HTTP 80
    run_cmd_safe(['iptables', '-t', 'nat', '-A', 'PREROUTING', '-i', 'wlan0', '-p', 'tcp', '--dport', '80', '-j', 'DNAT', '--to-destination', '192.168.4.1:80'])
    run_cmd_safe(['iptables', '-A', 'FORWARD', '-i', 'wlan0', '-p', 'tcp', '--dport', '80', '-j', 'ACCEPT'])

    # 3. Check HDMI status & render QR code fallback for headless mode
    hdmi = get_hdmi_status()
    print(f'[FORGE-AGENT] HDMI Status: {hdmi}')
    if hdmi == 'disconnected':
        print('[FORGE-AGENT] Headless Mode (No HDMI). Rendering CLI QR pairing code on TTY1...')
        run_cmd_safe('qrencode -t UTF8 "http://192.168.4.1" > /dev/tty1 2>/dev/null', shell=True)
        run_cmd_safe('echo "\nSSID: ForgeOS-Setup-btve10 | Pass: forgeos123 | Setup: http://192.168.4.1" > /dev/tty1 2>/dev/null', shell=True)

    # 4. Launch Captive Portal HTTP Server with fallback
    print('[FORGE-AGENT] Starting Captive Portal Web Server...')
    run_cmd_safe(['python3', '/opt/forgeos/captive-portal/server.py', '80'])

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
