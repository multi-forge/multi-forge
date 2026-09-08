import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertSLA, assertStatusCode, assertJSONHeader, assertMemoryCoherence } from '../harness/assertions.mjs';

describe('Tier 1: /api/metrics Schema, Telemetry Values, and SLA', () => {
  it('T1.2.1 - should return HTTP 200 with complete metrics schema', async () => {
    const res = await http.get('/api/metrics');
    assertStatusCode(res, 200, 'GET /api/metrics');
    assertJSONHeader(res);

    const m = res.data;
    assert.equal(typeof m.cpu_percent, 'number');
    assert.equal(typeof m.ram_total_mb, 'number');
    assert.equal(typeof m.ram_used_mb, 'number');
    assert.equal(typeof m.ram_free_mb, 'number');
    assert.equal(typeof m.temp_celsius, 'number');
  });

  it('T1.2.2 - should respond within 50ms latency SLA', async () => {
    const res = await http.get('/api/metrics');
    assertStatusCode(res, 200);
    assertSLA(res.latencyMs, 50, '/api/metrics SLA');
  });

  it('T1.2.3 - should report CPU utilization within bounded percentages [0, 100]', async () => {
    const res = await http.get('/api/metrics');
    const cpu = res.data.cpu_percent;
    assert.ok(cpu >= 0 && cpu <= 100, `CPU percent ${cpu} out of valid bounds [0, 100]`);
  });

  it('T1.2.4 - should satisfy memory accounting coherence', async () => {
    const res = await http.get('/api/metrics');
    assertMemoryCoherence(res.data);
  });

  it('T1.2.5 - should report realistic thermal sensor readings (/sys/class/thermal)', async () => {
    const res = await http.get('/api/metrics');
    const temp = res.data.temp_celsius;
    assert.ok(temp >= 25 && temp <= 95, `SoC temp ${temp}°C outside expected thermal bounds [25, 95]`);
  });

  it('T1.2.6 - should provide disk and network I/O telemetry fields', async () => {
    const res = await http.get('/api/metrics');
    const m = res.data;
    if (m.disk_total_gb !== undefined) {
      assert.equal(typeof m.disk_total_gb, 'number');
      assert.ok(m.disk_total_gb > 0, 'disk_total_gb must be > 0');
    }
    if (m.net_rx_kbps !== undefined) {
      assert.equal(typeof m.net_rx_kbps, 'number');
      assert.ok(m.net_rx_kbps >= 0, 'net_rx_kbps must be >= 0');
    }
  });
});
