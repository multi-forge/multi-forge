#!/usr/bin/env python3
"""ForgeOS Provisioning Portal — REST API + static files.

Single-radio appliance: serves the captive portal UI on :8080 and
orchestrates client-mode provisioning via apply-client.sh.
"""
import json
import os
import re
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = "/opt/forgeos"
WEB = os.path.join(BASE, "web")
STATE = os.path.join(BASE, "state")
APPLY = os.path.join(BASE, "bin", "apply-client.sh")
PORT = 8080

os.makedirs(STATE, exist_ok=True)


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


def status_payload():
    result = read_json(os.path.join(STATE, "result.json")) or {}
    attempt = read_json(os.path.join(STATE, "attempt.json")) or {}
    applying = False
    apath = os.path.join(STATE, "applying")
    if os.path.exists(apath):
        age = time.time() - os.path.getmtime(apath)
        if age < 180:
            applying = True
        else:
            try:
                os.remove(apath)
            except OSError:
                pass
    client_connected = bool(result.get("status") == "connected" and not ap_active())
    last = None
    if result:
        ts = time.strftime("%d/%m %H:%M", time.localtime(result.get("ts", 0)))
        last = f"{result.get('ssid', '?')} · {result.get('status', '?')} · {ts}"
    return {
        "ap_active": ap_active(),
        "ssid": "RTL8189FTV_AP",
        "provisioning": applying,
        "client_connected": client_connected,
        "client_ssid": result.get("ssid"),
        "client_ip": result.get("ip"),
        "last_failed": bool(result.get("status") == "failed"),
        "last_result": last,
        "attempt": attempt,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "ForgePortal/1.0"

    def log_message(self, fmt, *args):
        print(f"[PORTAL] {self.address_string()} {fmt % args}", flush=True)

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", f"{ctype}; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            return self._serve_file(os.path.join(WEB, "index.html"), "text/html")
        if path.startswith("/static/"):
            rel = os.path.normpath(path[len("/static/"):]).lstrip("/\\")
            full = os.path.join(WEB, "static", rel)
            if not full.startswith(os.path.join(WEB, "static")):
                return self._send(403, {"error": "forbidden"})
            ctype = "text/css" if rel.endswith(".css") else "application/octet-stream"
            return self._serve_file(full, ctype)
        if path == "/api/status":
            return self._send(200, status_payload())
        return self._send(404, {"error": "not found"})

    def _serve_file(self, full, ctype):
        try:
            with open(full, "rb") as f:
                return self._send(200, f.read(), ctype)
        except OSError:
            return self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.split("?")[0] == "/api/reset":
            for f in ("result.json", "attempt.json", "provision.json", "applying"):
                try:
                    os.remove(os.path.join(STATE, f))
                except OSError:
                    pass
            subprocess.Popen(["bash", os.path.join(BASE, "bin", "start-ap.sh")],
                             stdout=open("/var/log/forge-ap.log", "a"),
                             stderr=subprocess.STDOUT)
            return self._send(200, {"ok": True})

        if self.path.split("?")[0] != "/api/provision":
            return self._send(404, {"error": "not found"})

        if status_payload()["provisioning"]:
            return self._send(409, {"error": "provisionamento já em andamento"})

        length = min(int(self.headers.get("Content-Length", 0)), 8192)
        try:
            data = json.loads(self.rfile.read(length))
        except Exception:
            return self._send(400, {"error": "json inválido"})

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
        return self._send(200, {"ok": True, "message": "testando conexão"})


def validate(d):
    ssid = d.get("ssid", "")
    if not isinstance(ssid, str) or not (0 < len(ssid) <= 32):
        return "SSID inválido"
    if any(c in ssid for c in '"\n\r\t'):
        return "SSID contém caracteres inválidos"
    if d.get("mode") == "psk":
        p = d.get("password", "")
        if not isinstance(p, str) or len(p) < 8 or len(p) > 63:
            return "senha PSK deve ter 8–63 caracteres"
        return None
    if d.get("mode") == "eap":
        if not d.get("identity"):
            return "identidade obrigatória"
        if not d.get("password"):
            return "senha obrigatória"
        if d.get("method") not in ("PEAP", "TTLS"):
            return "método EAP inválido"
        if d.get("phase2") not in ("MSCHAPV2", "PAP"):
            return "phase2 inválido"
        for k in ("anonymous_identity", "domain"):
            v = d.get(k, "")
            if v and any(c in v for c in '"\n\r\t'):
                return f"{k} inválido"
        return None
    return "modo inválido"


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[PORTAL] ForgeOS portal on :{PORT}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
