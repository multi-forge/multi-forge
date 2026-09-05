import unittest
import requests
import time
import json
import os

BASE_URL = os.getenv("FORGE_URL", "http://localhost:8080")

class TestParity(unittest.TestCase):
    def test_01_api_status(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/status")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200, f"Expected 200, got {res.status_code}")
        
        data = res.json()
        self.assertIn("ap_active", data)
        self.assertIn("provisioning", data)
        self.assertIn("client_connected", data)
        
        # P0 redaction check
        dumped = json.dumps(data).lower()
        self.assertNotIn("password", dumped, "Security leak: password found in /api/status")
        self.assertNotIn("psk", dumped, "Security leak: psk found in /api/status")
        self.assertNotIn("identity", dumped, "Security leak: identity found in /api/status")
        
        print(f"[api/status] OK - {duration:.4f}s")

    def test_02_api_scan(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/scan")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        self.assertIn("networks", data)
        self.assertTrue(isinstance(data["networks"], list))
        
        print(f"[api/scan] OK - {duration:.4f}s")

    def test_03_api_ap_get(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/ap")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        self.assertIn("ssid", data)
        
        print(f"[api/ap GET] OK - {duration:.4f}s")

    def test_04_rest_metrics(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/rest/metrics")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        for k in ["timestamp", "cpu_pct", "ram_used_mb", "ram_total_mb", "uptime"]:
            self.assertIn(k, data)
            
        print(f"[rest/metrics] OK - {duration:.4f}s")

    def test_05_api_hardware(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/hardware")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        for k in ["device_model", "os_name", "kernel", "cpu_cores"]:
            self.assertIn(k, data)
            
        print(f"[api/hardware] OK - {duration:.4f}s")

    def test_06_api_services(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/services")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        self.assertIn("services", data)
        self.assertTrue(isinstance(data["services"], list))
        
        print(f"[api/services] OK - {duration:.4f}s")

    def test_07_api_logs(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/logs")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        self.assertIn("logs", data)
        self.assertTrue(isinstance(data["logs"], list))
        
        print(f"[api/logs] OK - {duration:.4f}s")

    def test_08_api_modules(self):
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/modules")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200)
        
        data = res.json()
        self.assertIn("modules", data)
        self.assertTrue(isinstance(data["modules"], list))
        
        print(f"[api/modules] OK - {duration:.4f}s")
        
    def test_09_api_provision_invalid_json(self):
        start = time.time()
        # Invalid JSON text
        res = requests.post(f"{BASE_URL}/api/provision", data="this is not json")
        duration = time.time() - start
        
        # Server.py returns 400 with {"error": "json invalido"}
        self.assertEqual(res.status_code, 400)
        
        print(f"[api/provision POST invalid] OK - {duration:.4f}s")
        
    def test_10_api_provision_invalid_data(self):
        start = time.time()
        # Invalid data structure
        res = requests.post(f"{BASE_URL}/api/provision", json={"ssid": 123})
        duration = time.time() - start
        
        # Server.py returns 400
        # If provisioning is in progress, it might return 409
        self.assertIn(res.status_code, [400, 409])
        
        print(f"[api/provision POST invalid data] OK - {duration:.4f}s")

    def test_11_static_files(self):
        files = ["/favicon.png", "/logo-sm.png"]
        for f in files:
            res = requests.get(f"{BASE_URL}{f}")
            self.assertIn(res.status_code, [200, 404]) # Since this is a test environment, files might not exist, but usually it returns 200 or 404 properly. But in our case we want to ensure it tries to serve.
            if res.status_code == 200:
                self.assertIn("image/png", res.headers.get("Content-Type", ""))
                
    def test_12_spa_fallback(self):
        # A random unmatched route should fallback to index.html (SPA)
        start = time.time()
        res = requests.get(f"{BASE_URL}/this-route-does-not-exist")
        duration = time.time() - start
        self.assertEqual(res.status_code, 200) # Since it's serving index.html
        self.assertIn("text/html", res.headers.get("Content-Type", ""))
        print(f"[SPA fallback] OK - {duration:.4f}s")
        
    def test_13_esp32_endpoints(self):
        eps = [
            "/rest/features", 
            "/rest/systemStatus", 
            "/rest/wifiStatus", 
            "/rest/ethernetStatus", 
            "/rest/apStatus", 
            "/rest/wifiScan"
        ]
        for ep in eps:
            res = requests.get(f"{BASE_URL}{ep}")
            self.assertEqual(res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
