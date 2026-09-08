import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 2: Wi-Fi Input Validation, Boundaries, and Special Characters', () => {
  it('T2.3.1 - should reject empty SSID with HTTP 400 Bad Request', async () => {
    await http.post('/api/reset');
    const res = await http.post('/api/provision', {
      ssid: '',
      password: 'validPassword123',
    });

    assertStatusCode(res, 400, 'Empty SSID');
    assert.equal(res.data.error, 'validation_error');
  });

  it('T2.3.2 - should reject whitespace-only SSID with HTTP 400', async () => {
    await http.post('/api/reset');
    const res = await http.post('/api/provision', {
      ssid: '   ',
      password: 'validPassword123',
    });

    assertStatusCode(res, 400, 'Whitespace SSID');
  });

  it('T2.3.3 - should reject WPA-PSK password shorter than 8 characters with HTTP 400', async () => {
    await http.post('/api/reset');
    const res = await http.post('/api/provision', {
      ssid: 'MyHomeWiFi',
      password: 'short', // 5 chars
      type: 'psk',
    });

    assertStatusCode(res, 400, 'Password < 8 chars');
    assert.equal(res.data.error, 'invalid_password');
    assert.ok(res.data.message.includes('8-63'));
  });

  it('T2.3.4 - should reject WPA-PSK password longer than 63 characters (non-hex) with HTTP 400', async () => {
    await http.post('/api/reset');
    const invalidLongPass = 'A'.repeat(64); // 64 ASCII chars (not hex)
    const res = await http.post('/api/provision', {
      ssid: 'MyHomeWiFi',
      password: invalidLongPass + 'extra', // 69 chars
      type: 'psk',
    });

    assertStatusCode(res, 400, 'Password > 63 chars');
    assert.equal(res.data.error, 'invalid_password');
  });

  it('T2.3.5 - should accept maximum length boundary of exactly 63 ASCII characters', async () => {
    await http.post('/api/reset');
    const valid63CharPass = 'Aa1!'.repeat(15) + '123'; // Exactly 63 chars
    assert.equal(valid63CharPass.length, 63);

    const res = await http.post('/api/provision', {
      ssid: 'MaxBoundarySSID',
      password: valid63CharPass,
      type: 'psk',
    });

    assertStatusCode(res, 200, '63-character password acceptance');
    assert.equal(res.data.status, 'applying');
  });

  it('T2.3.6 - should accept 64-character raw hexadecimal pre-computed PSK', async () => {
    await http.post('/api/reset');
    const hex64Pass = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert.equal(hex64Pass.length, 64);

    const res = await http.post('/api/provision', {
      ssid: 'HexPSKNetwork',
      password: hex64Pass,
      type: 'psk',
    });

    assertStatusCode(res, 200, '64-hex key acceptance');
    assert.equal(res.data.status, 'applying');
  });

  it('T2.3.7 - should reject SSIDs containing newline, return or tab characters', async () => {
    await http.post('/api/reset');
    const injectionSSIDs = [
      'BadSSID\nInjection',
      'BadSSID\rReturn',
      'BadSSID\tTab',
    ];

    for (const badSSID of injectionSSIDs) {
      const res = await http.post('/api/provision', {
        ssid: badSSID,
        password: 'validPassword123',
      });
      assertStatusCode(res, 400, `Rejection of control char SSID: ${JSON.stringify(badSSID)}`);
    }
  });

  it('T2.3.8 - should reject 802.1X EAP provisioning without identity', async () => {
    await http.post('/api/reset');
    const res = await http.post('/api/provision', {
      ssid: 'eduroam',
      password: 'AnyPassword123',
      type: 'eap',
      // identity missing
    });

    assertStatusCode(res, 400, 'Missing EAP identity');
    assert.equal(res.data.error, 'missing_identity');
  });
});
