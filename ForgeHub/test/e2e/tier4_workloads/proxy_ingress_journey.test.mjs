import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 4: Scenario 4 - Dynamic Reverse Proxy Lifecycle Ingress Flow', () => {
  it('T4.4.1 - should register, proxy, and cleanly deregister module ingress route', async () => {
    // 1. Initial State: App path returns 503 or 404
    const initialProbe = await http.get('/app/custom-analytics/dashboard');
    assert.ok(initialProbe.status === 503 || initialProbe.status === 404);

    // 2. Module start hooks register reverse proxy route
    const regRes = await http.post('/api/modules/web-scraping/register', {
      proxy_path: '/app/custom-analytics',
      target_url: 'http://127.0.0.1:8000',
    });
    assertStatusCode(regRes, 200, 'Step 2: Dynamic route registered');

    // 3. Ingress request arrives via ForgeHub portless router
    const ingressRes = await http.get('/app/custom-analytics/dashboard/metrics?view=compact');
    assertStatusCode(ingressRes, 200, 'Step 3: Ingress proxied successfully');
    assert.equal(ingressRes.data.proxied, true);
    assert.equal(ingressRes.data.module_id, 'web-scraping');
    assert.equal(ingressRes.data.target_path, '/dashboard/metrics?view=compact');

    // 4. Verify enriched headers for upstream application
    assert.equal(ingressRes.headers.get('x-forwarded-prefix'), '/app/custom-analytics');

    // 5. Module teardown deregisters the route
    const deregRes = await http.post('/api/modules/web-scraping/deregister');
    assertStatusCode(deregRes, 200, 'Step 5: Deregister route');

    // 6. Ingress is now cleanly severed
    const severedProbe = await http.get('/app/custom-analytics/dashboard');
    assert.ok(severedProbe.status === 503 || severedProbe.status === 404);
  });
});
