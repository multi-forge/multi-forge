import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 4: Scenario 2 - App Store Browsing, Pre-Flight RAM Check & Deployment', () => {
  it('T4.2.1 - should browse app store, verify pre-flight RAM guard, and deploy Mina IA', async () => {
    // 1. User browses Edge Store catalog
    const storeRes = await http.get('/api/store');
    assertStatusCode(storeRes, 200, 'Step 1: Browse Store Catalog');

    const app = storeRes.data.catalog.find((a) => a.id === 'mina-ia');
    assert.ok(app, 'Mina IA must exist in store catalog');
    assert.equal(app.min_ram_mb, 256, 'Mina IA requires 256 MB RAM');

    // 2. Pre-flight telemetry check: confirm system has >= 300 MB free RAM
    const metricsRes = await http.get('/api/metrics');
    assertStatusCode(metricsRes, 200, 'Step 2: Read system RAM');
    const freeRam = metricsRes.data.ram_free_mb;
    assert.ok(
      freeRam >= 300,
      `System must have >= 300 MB free RAM for launch (has ${freeRam} MB)`
    );

    // 3. One-click install / launch module
    const startRes = await http.post('/api/modules/mina-ia/start');
    assertStatusCode(startRes, 200, 'Step 3: Launch Mina IA module');
    assert.equal(startRes.data.status, 'running');

    // 4. Verify module state in module manager
    const modRes = await http.get('/api/modules/mina-ia');
    assertStatusCode(modRes, 200, 'Step 4: Verify module status');
    assert.equal(modRes.data.status, 'running');

    // 5. User accesses deployed application via reverse proxy URL
    const appRes = await http.get('/app/mina-ia/ui');
    assertStatusCode(appRes, 200, 'Step 5: Access application via reverse proxy');
    assert.equal(appRes.data.proxied, true);
    assert.equal(appRes.data.module_id, 'mina-ia');

    // 6. Clean up: stop module
    const stopRes = await http.post('/api/modules/mina-ia/stop');
    assertStatusCode(stopRes, 200);
  });
});
