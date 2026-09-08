import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertRedacted } from '../harness/assertions.mjs';

describe('Tier 1: P0 Security Redaction and Credential Protection', () => {
  it('T1.9.1 - should never expose cleartext passwords or PSKs in /api/status response', async () => {
    const res = await http.get('/api/status');
    assertStatusCode(res, 200);
    assertRedacted(res.data, 'status response');
  });

  it('T1.9.2 - should never echo cleartext passwords back in /api/provision response', async () => {
    const res = await http.post('/api/provision', {
      ssid: 'TestSecureNetwork',
      password: 'SuperSecretPassword123!',
      type: 'psk',
    });
    assertStatusCode(res, 200);

    // Response must not contain the cleartext password
    const raw = res.rawBody;
    assert.ok(
      !raw.includes('SuperSecretPassword123!'),
      'P0 Violation: Cleartext password was reflected in provision response!'
    );
    assertRedacted(res.data, 'provision response');
  });

  it('T1.9.3 - should protect 802.1X EAP enterprise credentials from reflection', async () => {
    const res = await http.post('/api/provision', {
      ssid: 'eduroam',
      identity: 'researcher@unesp.br',
      password: 'EnterpriseEAPPassword#456',
      type: 'eap',
      eap_method: 'PEAP',
      phase2: 'MSCHAPV2',
    });
    assertStatusCode(res, 200);

    const raw = res.rawBody;
    assert.ok(
      !raw.includes('EnterpriseEAPPassword#456'),
      'P0 Violation: Cleartext EAP password reflected in API response'
    );
    assertRedacted(res.data, 'EAP provision response');
  });

  it('T1.9.4 - should never include pre-shared keys in Wi-Fi scan results', async () => {
    const res = await http.get('/api/scan');
    assertStatusCode(res, 200);

    for (const net of res.data.networks) {
      assert.equal(net.password, undefined, 'Scan networks must not contain password key');
      assert.equal(net.psk, undefined, 'Scan networks must not contain psk key');
      assertRedacted(net, `scan network '${net.ssid}'`);
    }
  });

  it('T1.9.5 - should verify assertion engine catches simulated plaintext leaks', () => {
    const safePayload = {
      user: 'admin',
      password: '***',
      settings: { psk: '***' },
    };
    // Should not throw
    assertRedacted(safePayload);

    const leakyPayload = {
      user: 'admin',
      password: 'unmasked_cleartext_password',
    };
    assert.throws(
      () => assertRedacted(leakyPayload),
      /P0 Security Redaction violation/
    );
  });
});
