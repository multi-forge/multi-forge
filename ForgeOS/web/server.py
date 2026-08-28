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

BASE = "/opt/forgeos"
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

        # --- SPA fallback: any unmatched route → index.html ---
        return self._serve_file(os.path.join(WEB, "index.html"), "text/html")

    def do_POST(self):
        path = self.path.split("?")[0]

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
