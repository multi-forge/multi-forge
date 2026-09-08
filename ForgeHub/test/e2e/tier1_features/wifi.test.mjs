import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertJSONHeader, assertSLA } from '../harness/assertions.mjs';

describe('Tier 1: Wi-Fi Scan and Status Endpoints (/api/scan, /api/ap)', () => {
  it('T1.8.1 - should return list of available wireless networks via GET /api/scan', async () => {
    const res = await http.get('/api/scan');
    assertStatusCode(res, 200, 'GET /api/scan');
    assertJSONHeader(res);

    assert.ok(Array.isArray(res.data.networks), 'networks must be an array');
    assert.ok(res.data.networks.length >= 2, 'scan must return discovered networks');
  });

  it('T1.8.2 - should enforce Wi-Fi scan network schema requirements', async () => {
    const res = await http.get('/api/scan');
    const networks = res.data.networks;

    for (const net of networks) {
      assert.ok(net.ssid, 'Network must have ssid');
      assert.equal(typeof net.rssi, 'number', 'rssi must be number (dBm)');
      assert.ok(net.encryption, 'Network must have encryption specification');
    }
  });

  it('T1.8.3 - should validate RSSI signal strengths are within realistic physical bounds [-100, -20] dBm', async () => {
    const res = await http.get('/api/scan');
    for (const net of res.data.networks) {
      assert.ok(
        net.rssi >= -100 && net.rssi <= -20,
        `RSSI value ${net.rssi} dBm for SSID '${net.ssid}' outside realistic bounds [-100, -20]`
      );
    }
  });

  it('T1.8.4 - should detect both WPA2-PSK and 802.1X EAP (eduroam) security types', async () => {
    const res = await http.get('/api/scan');
    const encTypes = res.data.networks.map((n) => n.encryption);

    assert.ok(encTypes.includes('psk'), 'Scan must detect WPA2-PSK networks');
    assert.ok(encTypes.includes('eap'), 'Scan must detect 802.1X EAP networks');
  });

  it('T1.8.5 - should return AP configuration on GET /api/ap', async () => {
    const res = await http.get('/api/ap');
    assertStatusCode(res, 200, 'GET /api/ap');

    assert.equal(res.data.ip, '192.168.4.1', 'AP IP must be 192.168.4.1');
    assert.ok(res.data.ssid, 'AP SSID must be present');
    assert.equal(typeof res.data.channel, 'number', 'AP channel must be integer');
  });

  it('T1.8.6 - should respond within 50ms latency SLA for Wi-Fi discovery', async () => {
    const res = await http.get('/api/scan');
    assertStatusCode(res, 200);
    assertSLA(res.latencyMs, 50, '/api/scan SLA');
  });
});
