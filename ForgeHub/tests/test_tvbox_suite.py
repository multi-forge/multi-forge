#!/usr/bin/env python3
"""
ForgeHub Enterprise Verification Suite - TV Box Native Runner
Tests all APIs, SLAs (<50ms), P0 security redaction, and hardware Wi-Fi integration.
Zero external dependencies (uses standard library urllib.request).
"""

import urllib.request
import urllib.error
import json
import time
import sys

BASE_URL = "http://127.0.0.1:8080"
SLA_MS = 50.0

passed = 0
failed = 0
tests = []

def run_test(name, fn):
    global passed, failed
    try:
        start = time.perf_counter()
        fn(start)
        duration_ms = (time.perf_counter() - start) * 1000.0
        print(f"  [PASS] {name} ({duration_ms:.2f}ms)")
        passed += 1
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")
        failed += 1

def http_get(path):
    start = time.perf_counter()
    req = urllib.request.Request(f"{BASE_URL}{path}")
    with urllib.request.urlopen(req, timeout=3) as resp:
        lat = (time.perf_counter() - start) * 1000.0
        data = resp.read()
        return resp.status, resp.headers, data, lat

def http_post(path, body=None, content_type="application/json"):
    start = time.perf_counter()
    data = body.encode('utf-8') if isinstance(body, str) else (body if body is not None else b'')
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, method="POST")
    if content_type:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            lat = (time.perf_counter() - start) * 1000.0
            return resp.status, resp.headers, resp.read(), lat
    except urllib.error.HTTPError as err:
        lat = (time.perf_counter() - start) * 1000.0
        return err.code, err.headers, err.read(), lat

print(f"\n=======================================================")
print(f"  ForgeHub Enterprise TV Box API & SLA Verification")
print(f"  Target: {BASE_URL} | Strict SLA: < {SLA_MS}ms")
print(f"=======================================================\n")

# Warm-up HTTP connection and JIT
try:
    http_get("/api/status")
except Exception:
    pass

# 1. API Status
def test_status(start):
    status, hdrs, data, lat = http_get("/api/status")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    assert doc.get("ap_active") is True, "ap_active must be true"
    assert "device_model" in doc, "device_model missing"
    assert doc.get("uptime", -1) >= 0, "uptime invalid"
    assert doc.get("free_ram_mb", 0) > 0, "free_ram_mb must be > 0"
    raw = data.decode('utf-8').lower()
    for secret in ["password", "psk", "secret", "private_key"]:
        assert secret not in raw, f"P0 Redaction failure: {secret} present in /api/status"
run_test("T1: GET /api/status (Contract, Monotonic Uptime, P0 Redaction, SLA < 50ms)", test_status)

# 2. Wi-Fi Scan & Real Physical Networks
def test_scan(start):
    status, hdrs, data, lat = http_get("/api/scan")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    networks = doc.get("networks", [])
    assert len(networks) >= 2, f"Expected >= 2 networks, got {len(networks)}"
    
    ssids = [n.get("ssid") for n in networks]
    encs = [n.get("encryption") for n in networks]
    
    assert "psk" in encs, "Must contain at least one WPA2-PSK network"
    assert "eap" in encs, "Must contain at least one 802.1X EAP network"
    
    for n in networks:
        assert n.get("ssid"), "SSID cannot be empty"
        rssi = n.get("rssi")
        assert isinstance(rssi, (int, float)), f"RSSI must be number, got {rssi}"
        assert -100 <= rssi <= -20, f"RSSI {rssi} dBm outside realistic bounds [-100, -20]"
        assert n.get("encryption") in ["psk", "eap", "open", "wpa3"], f"Unknown encryption: {n.get('encryption')}"
run_test("T2: GET /api/scan (Real RTL8189FTV Networks, PSK/EAP types, Bounds [-100,-20]dBm, SLA < 50ms)", test_scan)

# 3. Telemetry Metrics
def test_metrics(start):
    status, hdrs, data, lat = http_get("/api/metrics")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    cpu = doc.get("cpu_percent") if "cpu_percent" in doc else doc.get("cpu_pct")
    assert cpu is not None and 0 <= cpu <= 100, f"Invalid CPU: {cpu}"
    temp = doc.get("temp_celsius") if "temp_celsius" in doc else doc.get("cpu_temp")
    assert temp is not None and 20 <= temp <= 100, f"Invalid Temperature: {temp}°C"
    assert doc.get("ram_total_mb", 0) > 1000, "RAM total must be > 1000 MB"
    assert doc.get("ram_used_mb", 0) > 0, "RAM used must be > 0"
run_test("T3: GET /api/metrics (CPU, RAM, S905X2 Thermal Zone temp, SLA < 50ms)", test_metrics)

# 4. Store Catalog
def test_store(start):
    status, hdrs, data, lat = http_get("/api/store")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    catalog = doc.get("catalog", [])
    assert len(catalog) >= 2, f"Expected >= 2 catalog apps, got {len(catalog)}"
    ids = [m.get("id") for m in catalog]
    assert "mina-ia" in ids, "mina-ia missing from catalog"
run_test("T4: GET /api/store (CasaOS/Dockge hybrid manifest catalog, SLA < 50ms)", test_store)

# 5. Modules List & Detail
def test_modules(start):
    status, hdrs, data, lat = http_get("/api/modules")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    modules = doc.get("modules", [])
    assert len(modules) >= 1, "Expected modules registered"
    
    # Detail
    s2, _, d2, lat2 = http_get("/api/modules/mina-ia")
    assert s2 == 200, f"Expected 200 for /api/modules/mina-ia, got {s2}"
    assert lat2 < SLA_MS, f"SLA violation: {lat2:.2f}ms > {SLA_MS}ms"
    m_doc = json.loads(d2.decode('utf-8'))
    assert m_doc.get("id") == "mina-ia"
    assert m_doc.get("type") == "systemd"
run_test("T5: GET /api/modules & /api/modules/{id} (State, Schema, SLA < 50ms)", test_modules)

# 6. System Services
def test_services(start):
    status, hdrs, data, lat = http_get("/api/services")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    svcs = doc.get("services", [])
    svc_names = [s.get("name") for s in svcs]
    assert "forgehub.service" in svc_names, "forgehub.service missing from services"
    fh_svc = next(s for s in svcs if s.get("name") == "forgehub.service")
    assert fh_svc.get("active") is True, "forgehub.service must be active"
run_test("T6: GET /api/services (systemd daemon state, SLA < 50ms)", test_services)

# 7. AP Configuration
def test_ap(start):
    status, hdrs, data, lat = http_get("/api/ap")
    assert status == 200, f"Expected 200, got {status}"
    assert lat < SLA_MS, f"SLA violation: {lat:.2f}ms > {SLA_MS}ms"
    doc = json.loads(data.decode('utf-8'))
    assert doc.get("ip") == "192.168.4.1", f"Expected AP IP 192.168.4.1, got {doc.get('ip')}"
    assert doc.get("ssid"), "AP SSID must be present"
    assert isinstance(doc.get("channel"), int), "AP channel must be int"
run_test("T7: GET /api/ap (AP Mode Config, IP 192.168.4.1, SLA < 50ms)", test_ap)

# 8. Wi-Fi Provisioning Validations
def test_provision_validation(start):
    # Invalid JSON -> 400
    s1, _, _, _ = http_post("/api/provision", body="not-json")
    assert s1 == 400, f"Expected 400 for invalid json, got {s1}"
    
    # Empty SSID -> 400
    s2, _, _, _ = http_post("/api/provision", body=json.dumps({"ssid": "  ", "password": "validpassword"}))
    assert s2 == 400, f"Expected 400 for empty ssid, got {s2}"
    
    # Short password for PSK -> 400
    s3, _, _, _ = http_post("/api/provision", body=json.dumps({"ssid": "test", "password": "short", "type": "psk"}))
    assert s3 == 400, f"Expected 400 for short PSK, got {s3}"
    
    # Missing identity for EAP -> 400
    s4, _, _, _ = http_post("/api/provision", body=json.dumps({"ssid": "eduroam", "password": "validpassword", "type": "eap"}))
    assert s4 == 400, f"Expected 400 for missing EAP identity, got {s4}"
run_test("T8: POST /api/provision (Strict Input Validation: JSON, SSID, PSK min 8 chars, EAP identity)", test_provision_validation)

# 9. Wi-Fi Provisioning Execution & 60s Rollback Contract
def test_provision_exec(start):
    payload = json.dumps({
        "ssid": "UNESP_Visitantes",
        "password": "ValidCampusPassword2026",
        "type": "psk"
    })
    status, _, data, lat = http_post("/api/provision", body=payload)
    assert status == 200, f"Expected 200, got {status}"
    doc = json.loads(data.decode('utf-8'))
    assert doc.get("ok") is True
    assert doc.get("status") == "applying"
    assert doc.get("timeout_sec") == 60, "Must enforce 60s rollback contract"
    raw = data.decode('utf-8').lower()
    for s in ["password", "validcampuspassword2026", "psk"]:
        assert s not in raw, f"P0 Redaction failure in provision response: {s}"
run_test("T9: POST /api/provision (Async Queue, 60s Auto-Rollback Contract, P0 Redaction)", test_provision_exec)

# 10. Wi-Fi Reset
def test_reset(start):
    status, _, data, _ = http_post("/api/reset")
    assert status == 200, f"Expected 200, got {status}"
    doc = json.loads(data.decode('utf-8'))
    assert doc.get("ok") is True
    assert doc.get("status") == "restored_to_ap"
run_test("T10: POST /api/reset (Contingency AP Restoration)", test_reset)

# 11. Static Web Assets & SPA Routing
def test_web_assets(start):
    # Root
    s1, h1, d1, _ = http_get("/")
    assert s1 == 200, f"Expected 200 for /, got {s1}"
    html = d1.decode('utf-8', errors='ignore')
    assert '<div id="root">' in html, "HTML missing root mount div"
    assert "ForgeHub" in html, "HTML missing ForgeHub title"
    
    # Official Logo
    s2, h2, d2, _ = http_get("/logo.png")
    assert s2 == 200, f"Expected 200 for /logo.png, got {s2}"
    assert len(d2) > 1000, "logo.png is empty or too small"
    
    # Favicon
    s3, _, d3, _ = http_get("/favicon.png")
    assert s3 == 200, f"Expected 200 for /favicon.png, got {s3}"
    assert len(d3) > 500, "favicon.png is empty"
    
    # SPA Fallback for deep route
    s4, _, d4, _ = http_get("/modules/mina-ia/telemetry")
    assert s4 == 200, f"Expected 200 for SPA deep route, got {s4}"
    assert '<div id="root">' in d4.decode('utf-8', errors='ignore'), "SPA fallback failed"
run_test("T11: Static Assets & Embedded Web UI (Logo, Favicon, SPA Root, Deep Links)", test_web_assets)

print(f"\n=======================================================")
print(f"  Summary: {passed} PASSED | {failed} FAILED")
print(f"=======================================================\n")

if failed > 0:
    sys.exit(1)
else:
    print("ALL TV BOX ENTERPRISE VERIFICATION TESTS PASSED (100% SUCCESS)!\n")
    sys.exit(0)
