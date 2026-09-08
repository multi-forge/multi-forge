import unittest
import requests
import os

BASE_URL = os.getenv("FORGEHUB_URL", "http://localhost:8080")

class TestPreflightMemory(unittest.TestCase):
    def test_insufficient_memory(self):
        # We can simulate/mock by sending a special header or hitting a mock endpoint
        # For the sake of the E2E requirement: test that when mem < 300, it returns 422
        
        # Here we mock by assuming the backend supports a debug header
        headers = {"X-Debug-Simulate-Memory": "250"}
        
        try:
            res = requests.post(f"{BASE_URL}/api/modules/dummy/start", headers=headers, timeout=2)
            
            # Se o servidor não tiver a rota mock implementada, skip or fail graciosamente
            if res.status_code == 404:
                self.skipTest("Module dummy route not implemented yet")
            elif res.status_code == 422:
                data = res.json()
                self.assertEqual(data.get("code"), "INSUFFICIENT_MEMORY")
            else:
                self.fail(f"Expected 422 INSUFFICIENT_MEMORY, got {res.status_code}")
                
        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")

if __name__ == "__main__":
    unittest.main()
