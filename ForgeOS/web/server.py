#!/usr/bin/env python3
"""ForgeOS Provisioning Portal v2.1 — REST API + SvelteKit SPA.

Single-radio appliance: serves the captive portal UI on :8080 and
orchestrates client-mode provisioning via apply-client.sh.

Backend compatible with ESP32-sveltekit frontend conventions:
  /rest/*  → REST API (features, systemStatus, wifiStatus, etc.)
  /ws/*    → WebSocket stubs (SSE fallback)
  /api/*   → ForgeOS provisioning API
  /_app/*  → SvelteKit build assets
"""
import json
import mimetypes
import os
import re
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import yaml
except ImportError:
    yaml = None

BASE = os.environ.get("FORGEOS_BASE", "/opt/forgeos" if os.path.exists("/opt/forgeos") else os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WEB = os.path.join(BASE, "web")
STATE = os.path.join(BASE, "state")
NETWORK = os.path.join(BASE, "network")
APPLY = os.path.join(BASE, "bin", "apply-client.sh")
PORT = 8080

os.makedirs(STATE, exist_ok=True)
mimetypes.init()


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def ap_active():
    try:
        out = subprocess.run(
            ["pgrep", "-f", "wpa_supplicant.*wpa_ap.conf"],
            capture_output=True, text=True)
        return out.returncode == 0
    except Exception:
        return False


def get_ap_config():
    conf_path = os.path.join(NETWORK, "wpa_ap.conf")
    config = {
        "ssid": "RTL8189FTV_AP",
        "password": "",
        "channel": 6,
        "ip": "192.168.4.1",
        "hidden": False
    }
    if os.path.exists(conf_path):
        try:
            with open(conf_path) as f:
                content = f.read()
                m_ssid = re.search(r'ssid="([^"]+)"', content)
                m_psk = re.search(r'psk="([^"]+)"', content)
                m_freq = re.search(r'frequency=([0-9]+)', content)
                if m_ssid:
                    config["ssid"] = m_ssid.group(1)
                if m_psk:
                    config["password"] = m_psk.group(1)
                if m_freq:
                    freq = int(m_freq.group(1))
                    config["channel"] = (freq - 2407) // 5 if freq < 3000 else (freq - 5000) // 5
        except Exception:
            pass
    return config


def status_payload():
    ap = ap_active()
    result = read_json(os.path.join(STATE, "result.json"))
    prov = read_json(os.path.join(STATE, "provision.json"))
    ap_state = read_json(os.path.join(STATE, "ap_state.json")) or {}
    applying = os.path.exists(os.path.join(STATE, "applying"))

    client_ip = None
    client_ssid = None
    client_connected = False
    if not ap:
        try:
            out = subprocess.run(
                ["ip", "-4", "addr", "show", "wlan0"],
                capture_output=True, text=True, timeout=5)
            m = re.search(r'inet\s+([\d.]+)', out.stdout)
            if m and m.group(1) != "192.168.4.1":
                client_ip = m.group(1)
                client_connected = True
        except Exception:
            pass
        if prov:
            client_ssid = prov.get("ssid")

    return {
        "ap_active": ap,
        "ssid": get_ap_config()["ssid"] if ap else None,
        "provisioning": applying,
        "client_connected": client_connected,
        "client_ssid": client_ssid,
        "client_ip": client_ip,
        "last_failed": bool(result and result.get("status") == "failed"),
        "last_result": result,
        "attempt": prov or {}
    }


def get_real_scan():
    # Windows local dev Wi-Fi scan fallback
    if os.name == "nt":
        try:
            out = subprocess.run(
                ["netsh", "wlan", "show", "networks", "mode=bssid"],
                capture_output=True, text=True, timeout=5, encoding="cp850", errors="replace")
            lines = out.stdout.splitlines()
            networks = []
            cur_ssid = None
            cur_auth = "psk"
            cur_bssid = None
            cur_signal = -60
            seen = set()

            for line in lines:
                line_s = line.strip()
                if line_s.startswith("SSID "):
                    parts = line_s.split(":", 1)
                    if len(parts) == 2:
                        cur_ssid = parts[1].strip()
                elif "Autentica" in line_s or "Authentication" in line_s:
                    if "Enterprise" in line_s or "802.1X" in line_s:
                        cur_auth = "eap"
                    elif "Open" in line_s or "Abrir" in line_s or "Nenhum" in line_s:
                        cur_auth = "open"
                    else:
                        cur_auth = "psk"
                elif line_s.startswith("BSSID "):
                    parts = line_s.split(":", 1)
                    if len(parts) == 2:
                        cur_bssid = parts[1].strip()
                elif "Sinal" in line_s or "Signal" in line_s:
                    m = re.search(r'(\d+)%', line_s)
                    if m:
                        cur_signal = int(m.group(1)) // 2 - 100
                elif "Canal" in line_s or "Channel" in line_s:
                    m = re.search(r'(\d+)', line_s)
                    if m:
                        cur_channel = int(m.group(1))
                        if cur_ssid and cur_ssid not in seen:
                            seen.add(cur_ssid)
                            networks.append({
                                "ssid": cur_ssid,
                                "bssid": cur_bssid or "",
                                "rssi": cur_signal,
                                "channel": cur_channel,
                                "encryption": cur_auth,
                                "flags": f"[{cur_auth.upper()}]"
                            })
            networks.sort(key=lambda x: x["rssi"], reverse=True)
            return networks
        except Exception as e:
            print(f"[SCAN-WIN] Error: {e}")
            return []

    try:
        ctrl = "/var/run/wpa_supplicant-ap"
        if not os.path.exists(os.path.join(ctrl, "wlan0")):
            ctrl = "/var/run/wpa_supplicant-client"
        if not os.path.exists(os.path.join(ctrl, "wlan0")):
            ctrl = "/var/run/wpa_supplicant"

        subprocess.run(
            ["wpa_cli", "-p", ctrl, "-i", "wlan0", "scan"],
            capture_output=True, text=True, timeout=5)
        time.sleep(3)
        out = subprocess.run(
            ["wpa_cli", "-p", ctrl, "-i", "wlan0", "scan_results"],
            capture_output=True, text=True, timeout=5)
        lines = out.stdout.strip().split("\n")
        networks = []
        seen = set()
        for line in lines[1:]:
            parts = line.split("\t")
            if len(parts) >= 5:
                bssid, freq, signal, flags, ssid = parts[0], parts[1], parts[2], parts[3], parts[4]
                ssid = ssid.strip()
                if not ssid or ssid in seen:
                    continue
                seen.add(ssid)
                enc = "psk"
                if "EAP" in flags or "802.1X" in flags:
                    enc = "eap"
                elif "ESS" in flags and "WPA" not in flags:
                    enc = "open"
                try:
                    f = int(freq)
                    ch = (f - 2407) // 5 if f < 3000 else (f - 5000) // 5
                except ValueError:
                    ch = 6
                networks.append({
                    "ssid": ssid,
                    "bssid": bssid,
                    "rssi": int(signal),
                    "channel": ch,
                    "encryption": enc,
                    "flags": flags
                })
        networks.sort(key=lambda x: x["rssi"], reverse=True)
        return networks
    except Exception as e:
        print(f"[SCAN] Error: {e}")
        return []


# --- ESP32-sveltekit compatibility layer ---

def esp32_features():
    return {
        "project": "ForgeOS",
        "version": "2.1.0",
        "firmware_version": "2.1.0",
        "device": "BTV-E10",
        "features": {
            "security": False,
            "mqtt": False,
            "ntp": True,
            "ota": False,
            "upload_firmware": False,
            "wifi": True
        }
    }


def esp32_system_status():
    try:
        with open("/proc/uptime") as f:
            uptime = float(f.read().split()[0])
    except Exception:
        uptime = 0
    try:
        mem = {}
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if parts[0] in ("MemTotal:", "MemAvailable:", "MemFree:"):
                    mem[parts[0].rstrip(":")] = int(parts[1]) * 1024
    except Exception:
        mem = {"MemTotal": 0, "MemAvailable": 0, "MemFree": 0}

    return {
        "esp_platform": "linux-aarch64",
        "firmware_version": "2.1.0",
        "max_alloc_heap": mem.get("MemAvailable", 0),
        "free_heap": mem.get("MemFree", 0),
        "total_heap": mem.get("MemTotal", 0),
        "sketch_size": 0,
        "free_sketch_space": 0,
        "sdk_version": "Armbian",
        "flash_chip_size": 0,
        "cpu_freq_mhz": 1200,
        "cpu_type": "Amlogic S905X2",
        "cpu_cores": 4,
        "uptime": int(uptime)
    }


def esp32_wifi_status():
    ap = ap_active()
    status = {
        "status": 3 if ap else 0,
        "local_ip": "192.168.4.1" if ap else "",
        "mac_address": "",
        "rssi": 0,
        "ssid": "",
        "bssid": "",
        "channel": 6,
        "subnet_mask": "255.255.255.0",
        "gateway_ip": "192.168.4.1",
        "dns_ip_1": "192.168.4.1"
    }
    try:
        out = subprocess.run(["ip", "link", "show", "wlan0"],
                             capture_output=True, text=True, timeout=3)
        m = re.search(r'link/ether\s+([\da-f:]+)', out.stdout)
        if m:
            status["mac_address"] = m.group(1).upper()
    except Exception:
        pass
    if not ap:
        s = status_payload()
        if s.get("client_ip"):
            status["local_ip"] = s["client_ip"]
        if s.get("client_ssid"):
            status["ssid"] = s["client_ssid"]
        status["status"] = 3 if s.get("client_connected") else 6
    return status


def esp32_ethernet_status():
    result = {
        "status": 0,
        "local_ip": "",
        "mac_address": "",
        "connected": False
    }
    try:
        out = subprocess.run(["ip", "-4", "addr", "show", "eth0"],
                             capture_output=True, text=True, timeout=3)
        m_ip = re.search(r'inet\s+([\d.]+)', out.stdout)
        if m_ip:
            result["local_ip"] = m_ip.group(1)
            result["connected"] = True
            result["status"] = 3
        out2 = subprocess.run(["ip", "link", "show", "eth0"],
                              capture_output=True, text=True, timeout=3)
        m_mac = re.search(r'link/ether\s+([\da-f:]+)', out2.stdout)
        if m_mac:
            result["mac_address"] = m_mac.group(1).upper()
    except Exception:
        pass
    return result


def esp32_ap_status():
    cfg = get_ap_config()
    return {
        "status": 1 if ap_active() else 0,
        "ip_address": "192.168.4.1",
        "mac_address": "",
        "station_num": 0,
        "provision_mode": 1,
        "ssid": cfg["ssid"],
        "password": cfg["password"],
        "channel": cfg["channel"],
        "ssid_hidden": cfg.get("hidden", False),
        "max_clients": 4,
        "local_ip": "192.168.4.1"
    }


def esp32_scan():
    nets = get_real_scan()
    return {
        "networks": [
            {
                "ssid": n["ssid"],
                "bssid": n.get("bssid", ""),
                "rssi": n["rssi"],
                "channel": n["channel"],
                "encryption_type": 4 if n.get("encryption") == "psk" else (5 if n.get("encryption") == "eap" else 0)
            }
            for n in nets
        ]
    }


def find_repo_root():
    candidates = [
        os.path.dirname(BASE),
        "/opt/multi-forge",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    ]
    for c in candidates:
        if c and os.path.exists(os.path.join(c, "ForgeDB", "modules", "catalog.yaml")):
            return c
    return None


def get_modules_catalog():
    repo_root = find_repo_root()
    catalog_file = os.path.join(repo_root, "ForgeDB", "modules", "catalog.yaml") if repo_root else None

    if catalog_file and os.path.exists(catalog_file) and yaml:
        try:
            with open(catalog_file, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            modules = data.get("modules", [])
            for m in modules:
                mod_id = m.get("id")
                mod_yaml_path = os.path.join(repo_root, "ForgeDB", "modules", mod_id, "module.yaml")
                if os.path.exists(mod_yaml_path):
                    with open(mod_yaml_path, encoding="utf-8") as mf:
                        m_detail = yaml.safe_load(mf) or {}
                        m["requirements"] = m_detail.get("requirements", {})
                        m["variants"] = m_detail.get("variants", [])
                        m["author"] = m_detail.get("author", "")
                        m["license"] = m_detail.get("license", "")

                status_file = os.path.join(STATE, f"module_{mod_id}.json")
                if os.path.exists(status_file):
                    m["status"] = read_json(status_file) or {"state": "installed"}
                else:
                    m["status"] = {"state": "available"}
            return {"modules": modules, "total": len(modules)}
        except Exception as e:
            print(f"[MODULES] Error reading catalog: {e}")

    # Fallback default catalog
    return {
        "modules": [
            {
                "id": "totem",
                "name": "Mina — Assistente Virtual Acadêmica",
                "version": "1.0.0",
                "category": "ai",
                "icon": "🤖",
                "description": "Quiosque de voz inteligente com PyQt5, Picovoice Porcupine wake-word, STT/TTS e classificador MABI.",
                "source_path": "ForgeModules/totem",
                "tier": "stable",
                "promoted": True,
                "author": "G.E.R.A — UNESP Sorocaba",
                "license": "MIT",
                "requirements": {"min_ram_mb": 512, "min_storage_mb": 300, "python": ">=3.9"},
                "status": {"state": "available"}
            },
            {
                "id": "web-scraping",
                "name": "Coletor Acadêmico & RAG Agent",
                "version": "1.0.0",
                "category": "data",
                "icon": "🕸️",
                "description": "Pipeline assíncrono de coleta de dados universitários com FastAPI, LangChain RAG, PostgreSQL e Redis.",
                "source_path": "ForgeModules/sub-modulos/web-scraping",
                "tier": "beta",
                "promoted": False,
                "author": "G.E.R.A — UNESP Sorocaba",
                "license": "MIT",
                "requirements": {"min_ram_mb": 1024, "min_storage_mb": 500, "python": ">=3.12"},
                "status": {"state": "available"}
            }
        ],
        "total": 2
    }


# --- Cockpit & Hardware Telemetry Functions ---

def get_cockpit_telemetry():
    # 1. CPU & Thermal
    temp_c = 0.0
    try:
        if os.path.exists("/sys/class/thermal/thermal_zone0/temp"):
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                temp_c = round(float(f.read().strip()) / 1000.0, 1)
    except Exception:
        temp_c = 43.5

    cpu_freq_mhz = 1800
    try:
        if os.path.exists("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq"):
            with open("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq") as f:
                cpu_freq_mhz = int(int(f.read().strip()) / 1000)
    except Exception:
        pass

    load_avg = [0.0, 0.0, 0.0]
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().split()
            load_avg = [float(parts[0]), float(parts[1]), float(parts[2])]
    except Exception:
        pass

    # 2. Detailed RAM & ZRAM
    mem = {"MemTotal": 0, "MemFree": 0, "MemAvailable": 0, "Buffers": 0, "Cached": 0, "SwapTotal": 0, "SwapFree": 0}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                p = line.split()
                if p and p[0].rstrip(":") in mem:
                    mem[p[0].rstrip(":")] = int(p[1]) * 1024
    except Exception:
        pass

    total_ram_mb = round(mem["MemTotal"] / 1024 / 1024, 1) if mem["MemTotal"] else 1850.0
    free_ram_mb = round(mem["MemFree"] / 1024 / 1024, 1) if mem["MemFree"] else 1100.0
    avail_ram_mb = round(mem["MemAvailable"] / 1024 / 1024, 1) if mem["MemAvailable"] else 1350.0
    used_ram_mb = round((total_ram_mb - avail_ram_mb), 1) if total_ram_mb > avail_ram_mb else 350.0
    cached_ram_mb = round((mem["Buffers"] + mem["Cached"]) / 1024 / 1024, 1) if (mem["Buffers"] + mem["Cached"]) else 440.0

    zram_info = {"enabled": True, "algorithm": "zstd", "disksize_mb": 925, "used_mb": 0, "ratio": 3.0}
    try:
        out = subprocess.run(["zramctl", "--json"], capture_output=True, text=True, timeout=2)
        if out.returncode == 0 and out.stdout:
            zdata = json.loads(out.stdout)
            for dev in zdata.get("zramdevices", []):
                zram_info["enabled"] = True
                zram_info["name"] = dev.get("name", "zram0")
                zram_info["algorithm"] = dev.get("algorithm", "zstd")
                zram_info["disksize"] = dev.get("disksize", "925M")
                zram_info["data"] = dev.get("data", "0B")
                zram_info["compr"] = dev.get("compr", "0B")
    except Exception:
        pass

    # 3. Storage / Filesystems
    storage = []
    try:
        out = subprocess.run(["df", "-B1", "-P"], capture_output=True, text=True, timeout=3)
        for line in out.stdout.strip().split("\n")[1:]:
            parts = line.split()
            if len(parts) >= 6:
                fs, size, used, avail, pct, mount = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
                if mount in ("/", "/boot", "/tmp") or fs.startswith("/dev/"):
                    storage.append({
                        "device": fs,
                        "mount": mount,
                        "total_gb": round(int(size) / 1024 / 1024 / 1024, 2),
                        "used_gb": round(int(used) / 1024 / 1024 / 1024, 2),
                        "free_gb": round(int(avail) / 1024 / 1024 / 1024, 2),
                        "percent": int(pct.rstrip("%")),
                        "type": "MicroSD / eMMC (Ext4)" if "mmcblk" in fs else ("RAM tmpfs" if "tmpfs" in fs else "System")
                    })
    except Exception:
        storage = [
            {"device": "/dev/mmcblk1p2", "mount": "/", "total_gb": 29.0, "used_gb": 3.5, "free_gb": 25.5, "percent": 12, "type": "MicroSD / eMMC (Ext4)"},
            {"device": "/dev/mmcblk1p1", "mount": "/boot", "total_gb": 0.5, "used_gb": 0.17, "free_gb": 0.33, "percent": 34, "type": "Boot FAT32"}
        ]

    # 4. Network Interfaces
    network_ifaces = {}
    try:
        with open("/proc/net/dev") as f:
            for line in f.readlines()[2:]:
                p = line.split()
                if len(p) >= 17:
                    iface = p[0].rstrip(":")
                    if iface != "lo":
                        network_ifaces[iface] = {
                            "rx_bytes": int(p[1]),
                            "rx_mb": round(int(p[1]) / 1024 / 1024, 2),
                            "rx_packets": int(p[2]),
                            "tx_bytes": int(p[9]),
                            "tx_mb": round(int(p[9]) / 1024 / 1024, 2),
                            "tx_packets": int(p[10])
                        }
    except Exception:
        pass

    # 5. Uptime
    uptime_sec = 0
    try:
        with open("/proc/uptime") as f:
            uptime_sec = int(float(f.read().split()[0]))
    except Exception:
        uptime_sec = 86400

    # 6. Cockpit Status
    cockpit_running = False
    try:
        out = subprocess.run(["systemctl", "is-active", "cockpit.socket"], capture_output=True, text=True, timeout=2)
        cockpit_running = (out.stdout.strip() == "active")
    except Exception:
        cockpit_running = True

    return {
        "device": {
            "model": "BTV Express E10",
            "soc": "Amlogic S905X2 (4x ARM Cortex-A53 @ 1.8GHz)",
            "arch": "aarch64 / arm64",
            "kernel": os.uname().release if hasattr(os, "uname") else "Linux 6.18.44-ophub",
            "dtb": "meson-g12a-btv-e10-enterprise.dtb",
            "uptime_sec": uptime_sec,
            "uptime_str": f"{uptime_sec // 3600}h {(uptime_sec % 3600) // 60}m {uptime_sec % 60}s",
            "cockpit_available": True,
            "cockpit_running": cockpit_running,
            "cockpit_port": 9090
        },
        "cpu": {
            "cores": 4,
            "freq_mhz": cpu_freq_mhz,
            "temp_c": temp_c,
            "load_1m": load_avg[0],
            "load_5m": load_avg[1],
            "load_15m": load_avg[2],
            "usage_pct": min(100, int(load_avg[0] * 25))
        },
        "ram": {
            "total_mb": total_ram_mb,
            "used_mb": used_ram_mb,
            "free_mb": free_ram_mb,
            "avail_mb": avail_ram_mb,
            "cached_mb": cached_ram_mb,
            "usage_pct": round((used_ram_mb / total_ram_mb) * 100, 1) if total_ram_mb else 18.0
        },
        "zram": zram_info,
        "storage": storage,
        "network": network_ifaces
    }


def get_cockpit_services():
    core_units = [
        {"id": "forge-ap", "unit": "forge-ap.service", "name": "ForgeOS Access Point (Wi-Fi)", "desc": "Emissão de ponto de acesso 192.168.4.1/24"},
        {"id": "forge-portal", "unit": "forge-portal.service", "name": "ForgeOS Web Portal", "desc": "Servidor HTTP REST e Captive Portal (:8080)"},
        {"id": "forge-display", "unit": "forge-display.service", "name": "ForgeOS HDMI Kiosk", "desc": "Interface gráfica Full HD direto no framebuffer"},
        {"id": "forge-watchdog", "unit": "forge-watchdog.service", "name": "ForgeOS Network Watchdog", "desc": "Restauração automática de conexão em 75s"},
        {"id": "cockpit", "unit": "cockpit.socket", "name": "Cockpit Web Console", "desc": "Painel de administração Linux na porta :9090"},
        {"id": "ssh", "unit": "ssh.service", "name": "OpenSSH Server", "desc": "Acesso remoto seguro por terminal (:22)"},
        {"id": "dnsmasq", "unit": "dnsmasq.service", "name": "DNS & DHCP Server", "desc": "Atribuição de IPs e Captive Portal DNS"},
        {"id": "mina-totem", "unit": "forge-totem.service", "name": "Mina Totem AI (Módulo)", "desc": "Assistente Virtual de Voz Acadêmica"},
        {"id": "web-scraping", "unit": "forge-scraping.service", "name": "Coletor & RAG (Módulo)", "desc": "Pipeline acadêmico e FastAPI"}
    ]
    results = []
    for u in core_units:
        unit_name = u["unit"]
        state = "inactive"
        substate = "unknown"
        loaded = "loaded"
        pid = 0
        try:
            out = subprocess.run(["systemctl", "show", unit_name, "--property=ActiveState,SubState,LoadState,MainPID"], capture_output=True, text=True, timeout=2)
            if out.returncode == 0:
                props = dict(line.split("=", 1) for line in out.stdout.strip().split("\n") if "=" in line)
                state = props.get("ActiveState", "inactive")
                substate = props.get("SubState", "unknown")
                loaded = props.get("LoadState", "loaded")
                pid = int(props.get("MainPID", 0))
        except Exception:
            state = "active" if "forge" in u["id"] or "cockpit" in u["id"] else "inactive"

        results.append({
            "id": u["id"],
            "unit": unit_name,
            "name": u["name"],
            "description": u["desc"],
            "state": state,
            "substate": substate,
            "loaded": loaded,
            "pid": pid,
            "active": (state == "active")
        })
    return {"services": results, "total": len(results)}


def control_cockpit_service(unit_name, action):
    allowed_actions = {"start", "stop", "restart", "enable", "disable"}
    if action not in allowed_actions:
        return {"ok": False, "error": f"Ação inválida: {action}"}
    try:
        subprocess.run(["systemctl", action, unit_name], capture_output=True, text=True, timeout=10)
        return {"ok": True, "unit": unit_name, "action": action}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_cockpit_logs(unit_name=None, lines=50):
    lines_count = min(int(lines), 150)
    cmd = ["journalctl", "-n", str(lines_count), "--no-pager", "-o", "short-iso"]
    if unit_name and unit_name != "system":
        cmd.extend(["-u", unit_name])
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        raw_lines = [l for l in out.stdout.strip().split("\n") if l.strip()]
        return {"logs": raw_lines, "unit": unit_name or "system", "total": len(raw_lines)}
    except Exception as e:
        return {"logs": [f"Erro ao ler logs: {e}"], "unit": unit_name, "total": 1}


def exec_cockpit_terminal(cmd):
    if not cmd or not cmd.strip():
        return {"ok": False, "output": "Comando vazio"}
    try:
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
        output = out.stdout if out.stdout else out.stderr
        return {
            "ok": out.returncode == 0,
            "exit_code": out.returncode,
            "output": output or "[Comando executado sem retorno textual]"
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "exit_code": -1, "output": "Tempo limite de execução excedido (15s)"}
    except Exception as e:
        return {"ok": False, "exit_code": -1, "output": str(e)}


def get_module_detail(mod_id):
    repo_root = find_repo_root()
    if repo_root and yaml:
        mod_yaml_path = os.path.join(repo_root, "ForgeDB", "modules", mod_id, "module.yaml")
        if os.path.exists(mod_yaml_path):
            try:
                with open(mod_yaml_path, encoding="utf-8") as f:
                    detail = yaml.safe_load(f) or {}
                status_file = os.path.join(STATE, f"module_{mod_id}.json")
                detail["status"] = read_json(status_file) if os.path.exists(status_file) else {"state": "available"}
                return detail
            except Exception as e:
                print(f"[MODULES] Error loading module {mod_id}: {e}")
    catalog = get_modules_catalog()
    for m in catalog.get("modules", []):
        if m.get("id") == mod_id:
            return m
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "ForgePortal/2.1"

    def log_message(self, fmt, *args):
        print(f"[PORTAL] {self.address_string()} {fmt % args}", flush=True)

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _guess_type(self, path):
        mt, _ = mimetypes.guess_type(path)
        return mt or "application/octet-stream"

    def _serve_file(self, full, ctype=None):
        if ctype is None:
            ctype = self._guess_type(full)
        try:
            with open(full, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            if "/_app/immutable/" in full:
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            else:
                self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            return self._send(404, {"error": "not found"})

    def do_GET(self):
        path = self.path.split("?")[0]

        # --- SvelteKit SPA: serve _app/* assets ---
        if path.startswith("/_app/"):
            rel = os.path.normpath(path[1:])
            full = os.path.join(WEB, rel)
            if os.path.isfile(full) and full.startswith(WEB):
                return self._serve_file(full)
            return self._send(404, {"error": "not found"})

        # --- Static assets ---
        if path.startswith("/static/"):
            rel = os.path.normpath(path[len("/static/"):]).lstrip("/\\")
            full = os.path.join(WEB, "static", rel)
            if os.path.isfile(full) and full.startswith(os.path.join(WEB, "static")):
                return self._serve_file(full)
            return self._send(404, {"error": "not found"})

        # --- Direct file serving (favicon, logo, manifest, etc.) ---
        if path in ("/favicon.png", "/logo.png", "/manifest.json"):
            full = os.path.join(WEB, path.lstrip("/"))
            if os.path.isfile(full):
                return self._serve_file(full)

        # --- ESP32-sveltekit REST compat ---
        if path == "/rest/features":
            return self._send(200, esp32_features())
        if path == "/rest/systemStatus":
            return self._send(200, esp32_system_status())
        if path == "/rest/wifiStatus":
            return self._send(200, esp32_wifi_status())
        if path == "/rest/ethernetStatus":
            return self._send(200, esp32_ethernet_status())
        if path == "/rest/apStatus":
            return self._send(200, esp32_ap_status())
        if path == "/rest/wifiScan":
            return self._send(200, esp32_scan())

        # --- WebSocket stub (SSE) ---
        if path == "/ws/events":
            return self._send(200, {"type": "ping"})

        # --- ForgeOS API ---
        if path == "/api/status":
            return self._send(200, status_payload())
        if path == "/api/scan":
            nets = get_real_scan()
            return self._send(200, {"networks": nets})
        if path == "/api/ap":
            return self._send(200, get_ap_config())

        # --- Cockpit & Telemetry API ---
        if path in ("/rest/telemetry", "/api/cockpit/telemetry", "/api/telemetry", "/rest/system/info"):
            return self._send(200, get_cockpit_telemetry())
        if path in ("/api/cockpit/services", "/rest/services"):
            return self._send(200, get_cockpit_services())
        if path == "/api/cockpit/status":
            telem = get_cockpit_telemetry()
            return self._send(200, {
                "ok": True,
                "installed": telem["device"]["cockpit_available"],
                "running": telem["device"]["cockpit_running"],
                "port": telem["device"]["cockpit_port"]
            })
        if path == "/api/cockpit/logs":
            # parse query params if present
            unit = None
            lines = 50
            if "?" in self.path:
                qs = self.path.split("?", 1)[1]
                for param in qs.split("&"):
                    if "=" in param:
                        k, v = param.split("=", 1)
                        if k == "unit":
                            unit = v
                        elif k == "lines":
                            try:
                                lines = int(v)
                            except ValueError:
                                lines = 50
            return self._send(200, get_cockpit_logs(unit, lines))

        # --- Module Hub API ---
        if path in ("/rest/modules", "/api/modules"):
            return self._send(200, get_modules_catalog())
        if path.startswith("/rest/modules/") or path.startswith("/api/modules/"):
            mod_id = path.rstrip("/").split("/")[-1]
            detail = get_module_detail(mod_id)
            if detail:
                return self._send(200, detail)
            return self._send(404, {"error": f"module '{mod_id}' not found"})

        # --- SPA fallback: any unmatched route → index.html ---
        return self._serve_file(os.path.join(WEB, "index.html"), "text/html")

    def do_POST(self):
        path = self.path.split("?")[0]

        # --- Cockpit Services Action ---
        if path.startswith("/api/cockpit/service/"):
            parts = path.rstrip("/").split("/")
            if len(parts) >= 5:
                unit_name = parts[-2]
                action = parts[-1]
                res = control_cockpit_service(unit_name, action)
                return self._send(200 if res.get("ok") else 400, res)

        # --- Cockpit Terminal Execution ---
        if path == "/api/cockpit/exec":
            length = min(int(self.headers.get("Content-Length", 0)), 8192)
            try:
                data = json.loads(self.rfile.read(length))
                cmd = data.get("command", "").strip()
                res = exec_cockpit_terminal(cmd)
                return self._send(200 if res.get("ok") else 400, res)
            except Exception as e:
                return self._send(400, {"ok": False, "output": f"Erro no payload: {e}"})

        if path.startswith("/api/modules/") or path.startswith("/rest/modules/"):
            parts = path.rstrip("/").split("/")
            if len(parts) >= 4:
                mod_id = parts[-2]
                action = parts[-1]
                status_file = os.path.join(STATE, f"module_{mod_id}.json")
                if action == "install":
                    with open(status_file, "w") as sf:
                        json.dump({"state": "installed", "installed_at": int(time.time()), "active": True}, sf)
                    return self._send(200, {"ok": True, "message": f"Módulo '{mod_id}' instalado", "status": {"state": "installed", "active": True}})
                elif action == "start":
                    with open(status_file, "w") as sf:
                        json.dump({"state": "running", "started_at": int(time.time()), "active": True}, sf)
                    return self._send(200, {"ok": True, "message": f"Módulo '{mod_id}' iniciado", "status": {"state": "running", "active": True}})
                elif action == "stop":
                    with open(status_file, "w") as sf:
                        json.dump({"state": "stopped", "stopped_at": int(time.time()), "active": False}, sf)
                    return self._send(200, {"ok": True, "message": f"Módulo '{mod_id}' pausado", "status": {"state": "stopped", "active": False}})
                elif action == "uninstall":
                    try:
                        os.remove(status_file)
                    except OSError:
                        pass
                    return self._send(200, {"ok": True, "message": f"Módulo '{mod_id}' desinstalado", "status": {"state": "available"}})

        if path == "/api/reset":
            for f in ("result.json", "attempt.json", "provision.json", "applying"):
                try:
                    os.remove(os.path.join(STATE, f))
                except OSError:
                    pass
            if not status_payload()["ap_active"]:
                subprocess.Popen(["bash", os.path.join(BASE, "bin", "start-ap.sh")],
                                 stdout=open("/var/log/forge-ap.log", "a"),
                                 stderr=subprocess.STDOUT)
            return self._send(200, {"ok": True, "message": "Modo AP restaurado"})

        if path == "/api/ap":
            length = min(int(self.headers.get("Content-Length", 0)), 4096)
            try:
                data = json.loads(self.rfile.read(length))
                ssid = data.get("ssid", "RTL8189FTV_AP").strip()
                psk = data.get("password", "").strip()
                ch = int(data.get("channel", 6))
                freq = 2412 + (ch - 1) * 5
                key_mgmt = "WPA-PSK" if psk else "NONE"
                psk_line = '    psk="' + psk + '"\n' if psk else ""
                conf = (
                    "ctrl_interface=/var/run/wpa_supplicant-ap\n"
                    "ap_scan=1\n\n"
                    "network={\n"
                    '    ssid="' + ssid + '"\n'
                    "    mode=2\n"
                    "    key_mgmt=" + key_mgmt + "\n"
                    + psk_line +
                    "    frequency=" + str(freq) + "\n"
                    "}\n"
                )
                with open(os.path.join(NETWORK, "wpa_ap.conf"), "w") as f:
                    f.write(conf)
                subprocess.Popen(["bash", os.path.join(BASE, "bin", "start-ap.sh")],
                                 stdout=open("/var/log/forge-ap.log", "a"),
                                 stderr=subprocess.STDOUT)
                subprocess.run(["systemctl", "restart", "forge-display.service"], timeout=5)
                return self._send(200, {"ok": True, "message": "AP atualizado"})
            except Exception as e:
                return self._send(400, {"error": str(e)})

        if path == "/rest/wifiScan":
            return self._send(200, esp32_scan())

        if path != "/api/provision":
            return self._send(404, {"error": "not found"})

        if status_payload()["provisioning"]:
            return self._send(409, {"error": "provisionamento em andamento"})

        length = min(int(self.headers.get("Content-Length", 0)), 8192)
        try:
            data = json.loads(self.rfile.read(length))
        except Exception:
            return self._send(400, {"error": "json invalido"})

        err = validate(data)
        if err:
            return self._send(400, {"error": err})

        prov_path = os.path.join(STATE, "provision.json")
        with open(prov_path, "w") as f:
            json.dump(data, f)

        open(os.path.join(STATE, "applying"), "w").close()
        log = open("/var/log/forge-apply.log", "a")
        subprocess.Popen(["bash", APPLY, prov_path],
                         stdout=log, stderr=subprocess.STDOUT,
                         start_new_session=True)
        return self._send(200, {"ok": True, "message": "testando conexao"})


def validate(d):
    ssid = d.get("ssid", "")
    if not isinstance(ssid, str) or not (0 < len(ssid) <= 32):
        return "SSID invalido"
    if any(c in ssid for c in '"\n\r\t'):
        return "SSID contem caracteres invalidos"
    if d.get("mode") == "psk":
        p = d.get("password", "")
        if p and (not isinstance(p, str) or len(p) < 8 or len(p) > 63):
            return "senha PSK deve ter 8-63 caracteres"
        return None
    if d.get("mode") == "eap":
        if not d.get("identity"):
            return "identidade obrigatoria"
        if not d.get("password"):
            return "senha obrigatoria"
        if d.get("method") not in ("PEAP", "TTLS", "PWD", "TLS"):
            return "metodo EAP invalido"
        if d.get("phase2") not in ("MSCHAPV2", "PAP", "GTC"):
            return "phase2 invalido"
        for k in ("anonymous_identity", "domain"):
            v = d.get(k, "")
            if v and any(c in v for c in '"\n\r\t'):
                return k + " invalido"
        return None
    return "modo invalido"


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("[PORTAL] ForgeOS portal v2.1 on :" + str(PORT), flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
