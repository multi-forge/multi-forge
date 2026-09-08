import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertSLA, assertStatusCode, assertJSONHeader } from '../harness/assertions.mjs';

describe('Tier 1: /api/status Contract and SLA Verification', () => {
  it('T1.1.1 - should return HTTP 200 with mandatory status fields', async () => {
    const res = await http.get('/api/status');
    assertStatusCode(res, 200, 'GET /api/status');
    assertJSONHeader(res);

    const body = res.data;
    assert.equal(typeof body.ap_active, 'boolean', 'ap_active must be boolean');
    assert.equal(typeof body.provisioning, 'boolean', 'provisioning must be boolean');
    assert.equal(typeof body.client_connected, 'boolean', 'client_connected must be boolean');
    assert.equal(typeof body.device_model, 'string', 'device_model must be string');
    assert.equal(typeof body.uptime, 'number', 'uptime must be integer seconds');
    assert.ok(body.uptime >= 0, 'uptime must be non-negative');
  });

  it('T1.1.2 - should respond within 50ms latency SLA', async () => {
    const res = await http.get('/api/status');
    assertStatusCode(res, 200);
    assertSLA(res.latencyMs, 50, '/api/status SLA');
  });

  it('T1.1.3 - should include valid AP network configurations', async () => {
    const res = await http.get('/api/status');
    const body = res.data;

    assert.ok(body.ap_ssid, 'ap_ssid must be present');
    assert.equal(typeof body.ap_ssid, 'string');
    assert.equal(body.ap_ip, '192.168.4.1', 'AP default IP must be 192.168.4.1');
  });

  it('T1.1.4 - should have monotonically non-decreasing uptime across subsequent calls', async () => {
    const res1 = await http.get('/api/status');
    await new Promise((r) => setTimeout(r, 100));
    const res2 = await http.get('/api/status');

    assert.ok(
      res2.data.uptime >= res1.data.uptime,
      `Uptime must not decrease: first=${res1.data.uptime}, second=${res2.data.uptime}`
    );
  });

  it('T1.1.5 - should enforce HTTP method rules and reject POST with 405 Method Not Allowed', async () => {
    const res = await http.post('/api/status', { test: true });
    assert.ok(
      res.status === 405 || res.status === 404,
      `POST /api/status must be rejected with 405/404, got ${res.status}`
    );
  });

  it('T1.1.6 - should set Cache-Control headers to prevent stale telemetry caching', async () => {
    const res = await http.get('/api/status');
    const cacheControl = res.headers.get('cache-control') || '';
    assert.ok(
      cacheControl.includes('no-cache') || cacheControl.includes('no-store'),
      `Cache-Control must prevent caching, got: '${cacheControl}'`
    );
  });
});
