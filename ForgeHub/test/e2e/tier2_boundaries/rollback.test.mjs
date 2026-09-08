import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertJSONHeader } from '../harness/assertions.mjs';

describe('Tier 2: Wi-Fi Provisioning 60s Contingency Rollback Watchdog', () => {
  it('T2.2.1 - should return 60-second contingency rollback contract in provision response', async () => {
    // Reset to AP mode first
    await http.post('/api/reset');

    const res = await http.post('/api/provision', {
      ssid: 'Campus_Guest_AP',
      password: 'GuestPassword2026',
      type: 'psk',
    });

    assertStatusCode(res, 200, 'POST /api/provision contract');
    assertJSONHeader(res);
    assert.equal(res.data.status, 'applying');
    assert.equal(res.data.timeout_sec, 60, 'Watchdog timeout must be exactly 60 seconds');
    assert.ok(
      res.data.message.includes('60s'),
      'Provisioning message must state 60s auto-rollback guarantee'
    );
  });

  it('T2.2.2 - should reject concurrent provision requests with HTTP 409 Conflict', async () => {
    // Attempt second provision immediately while first is applying
    const res = await http.post('/api/provision', {
      ssid: 'AnotherNetwork',
      password: 'AnotherPassword123',
    });

    assertStatusCode(res, 409, 'Concurrent provision conflict');
    assert.equal(res.data.error, 'conflict');
    assert.ok(res.data.message.includes('andamento'));
  });

  it('T2.2.3 - should preserve AP IP 192.168.4.1 as safe fallback anchor during provisioning', async () => {
    const res = await http.get('/api/status');
    assertStatusCode(res, 200);
    assert.equal(res.data.ap_ip, '192.168.4.1', 'AP anchor IP must not change');
  });

  it('T2.2.4 - should immediately restore AP mode upon POST /api/reset', async () => {
    const res = await http.post('/api/reset');
    assertStatusCode(res, 200, 'POST /api/reset');
    assert.equal(res.data.status, 'restored_to_ap');

    // Confirm status reflects clean AP state
    const status = await http.get('/api/status');
    assert.equal(status.data.provisioning, false);
    assert.equal(status.data.ap_active, true);
  });

  it('T2.2.5 - should trigger rollback to AP when target network association fails', async () => {
    // Submit invalid/unreachable network to trigger simulated failure
    const res = await http.post('/api/provision', {
      ssid: 'invalid-network',
      password: 'WrongPassword!',
    });
    assertStatusCode(res, 200);

    // Allow simulated watchdog rollback to process
    await new Promise((r) => setTimeout(r, 600));

    const status = await http.get('/api/status');
    assert.equal(status.data.provisioning, false, 'Provisioning must end');
    assert.equal(status.data.ap_active, true, 'AP mode must be safely active after rollback');
  });
});
