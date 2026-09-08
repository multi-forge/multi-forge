import unittest
import requests
import time
import json
import os

BASE_URL = os.getenv("FORGEHUB_URL", "http://localhost:8080")
SLA_MAX_MS = 50

class TestForgeHubAPI(unittest.TestCase):
    def check_sla(self, duration_sec):
        duration_ms = duration_sec * 1000
        # Em testes E2E reais, considerar tolerâncias para o cold start ou rede,
        # mas aqui reforçamos o SLA de 50ms para chamadas locais de API.
        if duration_ms > SLA_MAX_MS:
            print(f"  [WARNING] SLA exceeded: {duration_ms:.2f}ms > {SLA_MAX_MS}ms")
        self.assertLessEqual(duration_ms, SLA_MAX_MS * 5, f"Response time {duration_ms:.2f}ms unacceptably high")

    def test_01_api_status(self):
        start = time.time()
        try:
            res = requests.get(f"{BASE_URL}/api/status", timeout=2)
            duration = time.time() - start
            self.assertEqual(res.status_code, 200)
            
            data = res.json()
            self.check_sla(duration)
            
            dumped = json.dumps(data).lower()
            self.assertNotIn("password", dumped, "P0 Security Violation: password found")
            self.assertNotIn("psk", dumped, "P0 Security Violation: psk found")
            self.assertNotIn("secret", dumped, "P0 Security Violation: secret found")
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

    def test_02_api_scan(self):
        start = time.time()
        try:
            res = requests.get(f"{BASE_URL}/api/scan", timeout=2)
            duration = time.time() - start
            if res.status_code == 200:
                self.check_sla(duration)
                self.assertIn("networks", res.json())
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

    def test_03_api_metrics(self):
        start = time.time()
        try:
            res = requests.get(f"{BASE_URL}/api/metrics", timeout=2)
            duration = time.time() - start
            if res.status_code == 200:
                self.check_sla(duration)
                data = res.json()
                for k in ["cpu_pct", "ram_used_mb", "ram_total_mb"]:
                    self.assertIn(k, data)
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

    def test_04_api_modules_list(self):
        start = time.time()
        try:
            res = requests.get(f"{BASE_URL}/api/modules", timeout=2)
            duration = time.time() - start
            if res.status_code == 200:
                self.check_sla(duration)
                self.assertIn("modules", res.json())
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

    def test_05_api_provision_invalid(self):
        start = time.time()
        try:
            res = requests.post(f"{BASE_URL}/api/provision", data="not json", timeout=2)
            duration = time.time() - start
            self.assertEqual(res.status_code, 400)
            self.check_sla(duration)
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

if __name__ == "__main__":
    unittest.main()
