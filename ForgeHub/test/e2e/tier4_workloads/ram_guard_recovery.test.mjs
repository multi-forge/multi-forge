import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 4: Scenario 3 - Pre-Flight Memory Guard Lockout and Recovery Lifecycle', () => {
  it('T4.3.1 - should block launch under memory pressure and recover once memory is released', async () => {
    // 1. Module Mina IA is currently running
    const startMina = await http.post('/api/modules/mina-ia/start');
    assertStatusCode(startMina, 200);

    // 2. Heavy stack Web Scraping is requested while memory is constrained (< 300 MB)
    const lowMemRes = await http.post('/api/modules/web-scraping/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '220' },
    });

    assertStatusCode(lowMemRes, 422, 'Step 2: Pre-flight Memory Guard blocks launch');
    assert.equal(lowMemRes.data.code, 'INSUFFICIENT_MEMORY');
    assert.ok(
      lowMemRes.data.message.includes('300 MB'),
      'Warning explains 300 MB threshold'
    );

    // 3. Verify web-scraping remained in stopped state
    const modCheck = await http.get('/api/modules/web-scraping');
    assert.equal(modCheck.data.status, 'stopped');

    // 4. User frees memory by stopping running Mina IA module
    const stopMina = await http.post('/api/modules/mina-ia/stop');
    assertStatusCode(stopMina, 200, 'Step 4: Free system memory');

    // 5. User re-attempts Web Scraping launch under healthy memory (1024 MB free)
    const retryRes = await http.post('/api/modules/web-scraping/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '1024' },
    });

    assertStatusCode(retryRes, 200, 'Step 5: Launch succeeds after memory recovery');
    assert.equal(retryRes.data.status, 'running');

    // 6. Clean up
    await http.post('/api/modules/web-scraping/stop');
  });
});
