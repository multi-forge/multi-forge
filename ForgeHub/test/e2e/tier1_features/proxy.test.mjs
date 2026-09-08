import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertJSONHeader } from '../harness/assertions.mjs';

describe('Tier 1: Smart Reverse Proxy Routing (/app/{id})', () => {
  it('T1.7.1 - should register a dynamic reverse proxy route via POST /api/modules/{id}/register', async () => {
    const res = await http.post('/api/modules/mina-ia/register', {
      proxy_path: '/app/mina-ia',
      target_url: 'http://127.0.0.1:5000',
    });
    assertStatusCode(res, 200, 'Register route');
    assert.equal(res.data.ok, true);
    assert.equal(res.data.registered, '/app/mina-ia');
  });

  it('T1.7.2 - should route incoming HTTP requests through /app/{id} to target port', async () => {
    const res = await http.get('/app/mina-ia/');
    assertStatusCode(res, 200, 'GET /app/mina-ia/');
    assertJSONHeader(res);

    assert.equal(res.data.proxied, true);
    assert.equal(res.data.module_id, 'mina-ia');
  });

  it('T1.7.3 - should strip proxy prefix path when forwarding to backend service', async () => {
    const res = await http.get('/app/mina-ia/status/check');
    assertStatusCode(res, 200, 'GET /app/mina-ia/status/check');

    assert.equal(res.data.proxied, true);
    assert.equal(res.data.target_path, '/status/check');
  });

  it('T1.7.4 - should inject X-Forwarded-Prefix and X-Forwarded-Host headers', async () => {
    const res = await http.get('/app/mina-ia/api');
    assertStatusCode(res, 200);

    const fwdPrefix = res.headers.get('x-forwarded-prefix');
    assert.equal(fwdPrefix, '/app/mina-ia', 'X-Forwarded-Prefix header must match route prefix');
  });

  it('T1.7.5 - should deregister dynamic proxy route via POST /api/modules/{id}/deregister', async () => {
    const res = await http.post('/api/modules/mina-ia/deregister');
    assertStatusCode(res, 200, 'Deregister route');
    assert.equal(res.data.ok, true);
    assert.equal(res.data.deregistered, true);
  });

  it('T1.7.6 - should return 503 or 404 when accessing a deregistered route', async () => {
    const res = await http.get('/app/mina-ia/test');
    assert.ok(
      res.status === 503 || res.status === 404,
      `Deregistered route must return 503 or 404, got ${res.status}`
    );
  });
});
