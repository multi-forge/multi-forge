import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 3: Pairwise - Dynamic Reverse Proxy Ingress During Module Transitions', () => {
  it('T3.3.1 - should correctly transition proxy responses from 503 to 200 and back to 503 across lifecycle', async () => {
    // 1. Ensure module stopped
    await http.post('/api/modules/mina-ia/stop');

    // 2. Query proxy path: must return 503 or 404
    const beforeRes = await http.get('/app/mina-ia/ping');
    assert.ok(beforeRes.status === 503 || beforeRes.status === 404);

    // 3. Start module
    const startRes = await http.post('/api/modules/mina-ia/start');
    assertStatusCode(startRes, 200);

    // 4. Query proxy path: must now return 200
    const runningRes = await http.get('/app/mina-ia/ping');
    assertStatusCode(runningRes, 200);
    assert.equal(runningRes.data.proxied, true);

    // 5. Stop module
    const stopRes = await http.post('/api/modules/mina-ia/stop');
    assertStatusCode(stopRes, 200);

    // 6. Query proxy path again: must revert to 503 or 404
    const afterRes = await http.get('/app/mina-ia/ping');
    assert.ok(afterRes.status === 503 || afterRes.status === 404);
  });

  it('T3.3.2 - should handle rapid start/stop cycling without leaving orphan proxy routes', async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const startRes = await http.post('/api/modules/mina-ia/start');
      assertStatusCode(startRes, 200);

      const probeRunning = await http.get('/app/mina-ia/health');
      assertStatusCode(probeRunning, 200);

      const stopRes = await http.post('/api/modules/mina-ia/stop');
      assertStatusCode(stopRes, 200);

      const probeStopped = await http.get('/app/mina-ia/health');
      assert.ok(probeStopped.status === 503 || probeStopped.status === 404);
    }
  });
});
