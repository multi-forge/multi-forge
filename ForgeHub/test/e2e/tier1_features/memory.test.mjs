import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertSLA } from '../harness/assertions.mjs';

describe('Tier 1: Memory Footprint and Idle Behavior Verification', () => {
  it('T1.4.1 - should report total RAM consistent with BTV Express E10 hardware profile (~2GB)', async () => {
    const res = await http.get('/api/metrics');
    assertStatusCode(res, 200);

    const totalRam = res.data.ram_total_mb;
    // BTV E10 has 2GB RAM; after CMA and kernel reservations, ~1805-2048MB is visible
    assert.ok(
      totalRam >= 1500 && totalRam <= 2100,
      `Reported total RAM ${totalRam} MB outside expected BTV E10 envelope [1500, 2100]`
    );
  });

  it('T1.4.2 - should maintain stable memory reporting under repeated queries', async () => {
    const memorySnapshots = [];
    for (let i = 0; i < 10; i++) {
      const res = await http.get('/api/metrics');
      assertStatusCode(res, 200);
      memorySnapshots.push(res.data.ram_used_mb);
    }

    const first = memorySnapshots[0];
    const last = memorySnapshots[memorySnapshots.length - 1];
    const delta = Math.abs(last - first);

    // Delta across 10 lightweight queries should not show runaway memory leakage (> 50 MB)
    assert.ok(
      delta <= 50,
      `Memory usage fluctuated excessively across sequential queries: delta=${delta} MB`
    );
  });

  it('T1.4.3 - should maintain sub-50ms SLA under sequential query bursts', async () => {
    const latencies = [];
    for (let i = 0; i < 5; i++) {
      const res = await http.get('/api/metrics');
      assertStatusCode(res, 200);
      latencies.push(res.latencyMs);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    assert.ok(avgLatency < 50, `Average burst latency ${avgLatency}ms exceeded 50ms SLA`);
  });

  it('T1.4.4 - should report non-negative free RAM available for workloads', async () => {
    const res = await http.get('/api/metrics');
    assertStatusCode(res, 200);
    assert.ok(res.data.ram_free_mb > 0, 'Available free RAM must be strictly positive');
  });

  it('T1.4.5 - should preserve status endpoint consistency during telemetry extraction', async () => {
    const [statusRes, metricsRes] = await Promise.all([
      http.get('/api/status'),
      http.get('/api/metrics'),
    ]);

    assertStatusCode(statusRes, 200);
    assertStatusCode(metricsRes, 200);
    assertSLA(statusRes.latencyMs, 50, 'Status SLA during parallel query');
    assertSLA(metricsRes.latencyMs, 50, 'Metrics SLA during parallel query');
  });
});
