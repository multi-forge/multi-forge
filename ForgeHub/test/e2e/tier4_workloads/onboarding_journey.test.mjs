import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertRedacted } from '../harness/assertions.mjs';

describe('Tier 4: Scenario 1 - Edge Appliance First-Boot Onboarding Journey', () => {
  it('T4.1.1 - should execute full onboarding from AP discovery to LAN connection', async () => {
    // 1. Initial State: Appliance boots in autonomous AP mode
    await http.post('/api/reset');
    const apRes = await http.get('/api/ap');
    assertStatusCode(apRes, 200, 'Step 1: Read AP configuration');
    assert.equal(apRes.data.ip, '192.168.4.1');
    assert.equal(apRes.data.ssid, 'Forge-E10');

    // 2. User verifies status via QR portal on 192.168.4.1:8080
    const statusRes = await http.get('/api/status');
    assertStatusCode(statusRes, 200, 'Step 2: Read initial status');
    assert.equal(statusRes.data.ap_active, true);
    assert.equal(statusRes.data.client_connected, false);

    // 3. User initiates Wi-Fi scan to locate local networks
    const scanRes = await http.get('/api/scan');
    assertStatusCode(scanRes, 200, 'Step 3: Trigger Wi-Fi scan');
    const networks = scanRes.data.networks;
    assert.ok(Array.isArray(networks) && networks.length > 0, 'Discovered networks must not be empty');
    const targetNet = networks.find((n) => n.encryption === 'psk') || networks[0];
    const candidateSSID = targetNet.ssid;
    assert.ok(candidateSSID, 'Candidate SSID must be present in scan');

    // 4. User selects network and submits credentials with 60s rollback contract
    const provisionRes = await http.post('/api/provision', {
      ssid: candidateSSID,
      password: 'CampusPassword2026',
      type: 'psk',
    });
    assertStatusCode(provisionRes, 200, 'Step 4: Submit provisioning credentials');
    assert.equal(provisionRes.data.status, 'applying');
    assert.equal(provisionRes.data.timeout_sec, 60);
    assertRedacted(provisionRes.data, 'Provisioning response');

    // 5. Allow simulated connection association & DHCP negotiation
    await new Promise((r) => setTimeout(r, 600));

    // 6. User verifies successful connection on operational LAN
    const finalStatus = await http.get('/api/status');
    assertStatusCode(finalStatus, 200, 'Step 5: Verify connected status');
    assert.equal(finalStatus.data.client_connected, true);
    assert.equal(finalStatus.data.client_ssid, candidateSSID);
    assert.ok(finalStatus.data.client_ip.length > 0, 'Client IP must be assigned');
  });
});
