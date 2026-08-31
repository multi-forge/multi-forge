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


# --- Real-time Metrics Engine (Cockpit style) ---
_last_cpu_times = None
_last_net_bytes = None
_last_metrics_time = 0.0

def get_realtime_metrics():
    global _last_cpu_times, _last_net_bytes, _last_metrics_time
    now = time.time()
    dt = max(now - _last_metrics_time, 0.1) if _last_metrics_time > 0 else 1.0
    _last_metrics_time = now

    # 1. CPU Usage %
    cpu_pct = 0.0
    try:
        with open("/proc/stat") as f:
            line = f.readline()
            if line.startswith("cpu "):
                fields = [float(x) for x in line.split()[1:]]
                idle_time = fields[3] + fields[4]
                total_time = sum(fields)
                if _last_cpu_times is not None:
                    prev_idle, prev_total = _last_cpu_times
                    diff_idle = idle_time - prev_idle
                    diff_total = total_time - prev_total
                    if diff_total > 0:
                        cpu_pct = round(max(0.0, min(100.0, (1.0 - diff_idle / diff_total) * 100.0)), 1)
                _last_cpu_times = (idle_time, total_time)
    except Exception:
        # Windows fallback or synthetic jitter
        import random
        cpu_pct = round(random.uniform(2.5, 12.0), 1)

    # 2. RAM Usage
    mem_total = 1980
    mem_avail = 1620
    mem_free = 1400
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                parts = line.split()
                if parts[0] == "MemTotal:":
                    mem_total = int(parts[1]) // 1024
                elif parts[0] == "MemAvailable:":
                    mem_avail = int(parts[1]) // 1024
                elif parts[0] == "MemFree:":
                    mem_free = int(parts[1]) // 1024
    except Exception:
        pass

    ram_used = max(0, mem_total - mem_avail)
    ram_pct = round((ram_used / max(mem_total, 1)) * 100.0, 1)

    # 3. Network Throughput (RX / TX KB/s)
    rx_rate_kbs = 0.0
    tx_rate_kbs = 0.0
    try:
        cur_rx = 0
        cur_tx = 0
        with open("/proc/net/dev") as f:
            for line in f:
                if ":" in line:
                    iface, stats = line.split(":", 1)
                    iface = iface.strip()
                    if iface in ("eth0", "wlan0"):
                        vals = stats.split()
                        cur_rx += int(vals[0])
                        cur_tx += int(vals[8])
        if _last_net_bytes is not None:
            prev_rx, prev_tx = _last_net_bytes
            rx_rate_kbs = round(max(0.0, (cur_rx - prev_rx) / (dt * 1024.0)), 1)
            tx_rate_kbs = round(max(0.0, (cur_tx - prev_tx) / (dt * 1024.0)), 1)
        _last_net_bytes = (cur_rx, cur_tx)
    except Exception:
        pass

    # 4. Uptime
    uptime_sec = 0
    try:
        with open("/proc/uptime") as f:
            uptime_sec = int(float(f.read().split()[0]))
    except Exception:
        uptime_sec = int(time.time() - 1756500000)

    # 5. Disk Usage
    disk_total_gb = 29.0
    disk_used_gb = 2.6
    try:
        st = os.statvfs("/")
        disk_total_gb = round((st.f_blocks * st.f_frsize) / (1024**3), 1)
        disk_free_gb = round((st.f_bavail * st.f_frsize) / (1024**3), 1)
        disk_used_gb = round(disk_total_gb - disk_free_gb, 1)
    except Exception:
        pass

    return {
        "timestamp": now,
        "cpu_pct": cpu_pct,
        "ram_used_mb": ram_used,
        "ram_total_mb": mem_total,
        "ram_pct": ram_pct,
        "rx_kbs": rx_rate_kbs,
        "tx_kbs": tx_rate_kbs,
        "uptime": uptime_sec,
        "disk_used_gb": disk_used_gb,
        "disk_total_gb": disk_total_gb
    }


def esp32_system_status():
    m = get_realtime_metrics()
    return {
        "esp_platform": "linux-aarch64",
        "firmware_version": "2.1.0",
        "max_alloc_heap": (m["ram_total_mb"] - m["ram_used_mb"]) * 1048576,
        "free_heap": (m["ram_total_mb"] - m["ram_used_mb"]) * 1048576,
        "total_heap": m["ram_total_mb"] * 1048576,
        "cpu_pct": m["cpu_pct"],
        "rx_kbs": m["rx_kbs"],
        "tx_kbs": m["tx_kbs"],
        "sketch_size": 0,
        "free_sketch_space": 0,
        "sdk_version": "Armbian",
        "flash_chip_size": 0,
        "cpu_freq_mhz": 1800,
        "cpu_type": "Amlogic S905X2",
        "cpu_cores": 4,
        "uptime": m["uptime"]
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

        # --- Systemd Services Management (Cockpit style) ---
        if path == "/api/services":
            services_list = [
                {"unit": "forge-portal.service", "desc": "Servidor Web & API REST", "category": "forgeos"},
                {"unit": "forge-ap.service", "desc": "Ponto de Acesso Wi-Fi & dnsmasq", "category": "forgeos"},
                {"unit": "forge-display.service", "desc": "Renderizador HDMI FB0 Dual QR", "category": "forgeos"},
                {"unit": "forge-watchdog.service", "desc": "Watchdog de Contingência 75s", "category": "forgeos"},
                {"unit": "forge-fbcon-disable.service", "desc": "Desabilitar Cursor Framebuffer", "category": "forgeos"},
                {"unit": "ssh.service", "desc": "Servidor SSH OpenSSH", "category": "system"},
                {"unit": "systemd-journald.service", "desc": "Coletor de Logs do Kernel", "category": "system"},
                {"unit": "systemd-timesyncd.service", "desc": "Sincronização de Relógio NTP", "category": "system"}
            ]
            for s in services_list:
                try:
                    out = subprocess.run(["systemctl", "is-active", s["unit"]], capture_output=True, text=True, timeout=2)
                    s["active"] = out.stdout.strip() == "active"
                    s["state"] = out.stdout.strip()
                except Exception:
                    s["active"] = True
                    s["state"] = "active"
            return self._send(200, {"services": services_list})

        # --- ESP32-sveltekit REST compat ---
        if path in ("/rest/metrics", "/api/telemetry"):
            return self._send(200, get_realtime_metrics())
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
        if path.startswith("/api/services/"):
            parts = path.rstrip("/").split("/")
            if len(parts) >= 4:
                unit = parts[-2]
                action = parts[-1]
                if action in ("restart", "start", "stop"):
                    try:
                        subprocess.Popen(["systemctl", action, unit])
                        return self._send(200, {"ok": True, "message": f"Serviço '{unit}' comando: {action}"})
                    except Exception as e:
                        return self._send(500, {"error": str(e)})

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
