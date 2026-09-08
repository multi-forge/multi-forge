import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 3: Pairwise - Simultaneous Wi-Fi Operations and Metrics Polling', () => {
  it('T3.2.1 - should execute concurrent Wi-Fi scans and metrics queries without degradation', async () => {
    // Fire 5 metrics queries concurrently with 2 Wi-Fi scan queries
    const requests = [
      http.get('/api/metrics'),
      http.get('/api/scan'),
      http.get('/api/metrics'),
      http.get('/api/scan'),
      http.get('/api/metrics'),
    ];

    const responses = await Promise.all(requests);
    assert.equal(responses.length, 5);

    for (const res of responses) {
      assertStatusCode(res, 200);
      assert.ok(res.latencyMs < 100, `Latency spike detected: ${res.latencyMs}ms`);
    }
  });

  it('T3.2.2 - should keep telemetry metrics polling stable while submitting provision commands', async () => {
    await http.post('/api/reset');

    const [metricsBefore, provisionRes, metricsAfter] = await Promise.all([
      http.get('/api/metrics'),
      http.post('/api/provision', {
        ssid: 'ConcurrentTestSSID',
        password: 'Password123!',
      }),
      http.get('/api/metrics'),
    ]);

    assertStatusCode(metricsBefore, 200);
    assertStatusCode(provisionRes, 200);
    assertStatusCode(metricsAfter, 200);

    assert.equal(provisionRes.data.status, 'applying');
    assert.ok(metricsBefore.data.ram_total_mb > 0);
    assert.ok(metricsAfter.data.ram_total_mb > 0);
  });
});
