import unittest
import requests
import threading
import time
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE_URL = os.getenv("FORGEHUB_URL", "http://localhost:8080")
MOCK_PORT = 19999

class MockAppHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        
        # O backend de ForgeHub em Go (reverse proxy) deve injetar X-Forwarded-Prefix
        prefix = self.headers.get("X-Forwarded-Prefix", "MISSING")
        self.wfile.write(f'{{"prefix": "{prefix}", "path": "{self.path}"}}'.encode())

class TestReverseProxy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", MOCK_PORT), MockAppHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever)
        cls.thread.daemon = True
        cls.thread.start()
        time.sleep(1)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_reverse_proxy_routing(self):
        try:
            # 1. Register mock app
            reg_res = requests.post(f"{BASE_URL}/api/modules/mock_app/register", json={
                "proxy_path": "/app/test",
                "target_url": f"http://127.0.0.1:{MOCK_PORT}"
            }, timeout=2)
            
            if reg_res.status_code == 404:
                self.skipTest("Reverse proxy registration not implemented in ForgeHub yet")
                
            self.assertEqual(reg_res.status_code, 200, "Should successfully register proxy route")

            # 2. Access via reverse proxy
            proxy_res = requests.get(f"{BASE_URL}/app/test/hello", timeout=2)
            self.assertEqual(proxy_res.status_code, 200)
            
            data = proxy_res.json()
            self.assertEqual(data.get("prefix"), "/app/test", "X-Forwarded-Prefix missing or wrong")
            # Usually the reverse proxy strips the prefix before hitting the target
            # Some implementations keep it, but we mainly check the prefix header here
            
            # 3. Deregister mock app
            unreg_res = requests.post(f"{BASE_URL}/api/modules/mock_app/deregister", timeout=2)
            self.assertEqual(unreg_res.status_code, 200)
            
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

if __name__ == "__main__":
    unittest.main()
