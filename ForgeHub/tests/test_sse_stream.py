import unittest
import requests
import json
import os
import time

BASE_URL = os.getenv("FORGEHUB_URL", "http://localhost:8080")

class TestSSEStream(unittest.TestCase):
    def test_sse_telemetry(self):
        try:
            # We connect to SSE and wait for at least one 'event: telemetry'
            res = requests.get(f"{BASE_URL}/api/events", stream=True, timeout=5)
            if res.status_code == 404:
                self.skipTest("SSE endpoint not implemented yet")
            self.assertEqual(res.status_code, 200)
            self.assertIn("text/event-stream", res.headers.get("Content-Type", ""))
            
            event_type = None
            payload = None
            
            # Read first event block
            for line in res.iter_lines(decode_unicode=True):
                if not line:
                    if event_type == "telemetry" and payload:
                        break
                    continue
                    
                if line.startswith("event: "):
                    event_type = line.split("event: ")[1].strip()
                elif line.startswith("data: "):
                    data_str = line.split("data: ")[1].strip()
                    try:
                        payload = json.loads(data_str)
                    except json.JSONDecodeError:
                        pass
                        
            res.close()
            
            self.assertEqual(event_type, "telemetry", "Expected event: telemetry")
            self.assertIsNotNone(payload, "Payload should be valid JSON")
            
            # Integridade de CPU, RAM, Térmica, Disco
            self.assertIn("cpu_pct", payload)
            self.assertIn("ram_used_mb", payload)
            self.assertIn("cpu_temp", payload)
            self.assertIn("disk_used_gb", payload)

        except requests.exceptions.ConnectionError:
            self.skipTest("ForgeHub server not reachable")
        except requests.exceptions.ReadTimeout:
            self.fail("Timeout waiting for SSE event")

if __name__ == "__main__":
    unittest.main()
