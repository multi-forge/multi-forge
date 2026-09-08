import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertJSONHeader } from '../harness/assertions.mjs';

describe('Tier 2: Error Handling, Route Fallbacks, and 404/503 Contracts', () => {
  it('T2.6.1 - should return HTTP 404 for non-existent module details', async () => {
    const res = await http.get('/api/modules/unknown-module-xyz');
    assertStatusCode(res, 404, 'Unknown module detail');
    assertJSONHeader(res);
    assert.equal(res.data.error, 'not_found');
  });

  it('T2.6.2 - should return HTTP 404 when attempting to start a non-existent module', async () => {
    const res = await http.post('/api/modules/ghost-module/start');
    assertStatusCode(res, 404, 'Start unknown module');
    assert.equal(res.data.error, 'not_found');
  });

  it('T2.6.3 - should return HTTP 503 or 404 when proxying to an unregistered module route', async () => {
    const res = await http.get('/app/ghost-app/health');
    assert.ok(
      res.status === 503 || res.status === 404,
      `Unregistered proxy route must return 503 or 404, received ${res.status}`
    );
    assertJSONHeader(res);
  });

  it('T2.6.4 - should return HTTP 400 Bad Request when receiving malformed JSON', async () => {
    const res = await http.post('/api/provision', '{ malformed_json: true, }', {
      headers: { 'Content-Type': 'application/json' },
    });

    assertStatusCode(res, 400, 'Malformed JSON rejection');
    assert.ok(res.data.error, 'Error payload must be structured JSON');
  });

  it('T2.6.5 - should reject PUT on /api/status with 405 Method Not Allowed', async () => {
    const res = await http.put('/api/status', {});
    assert.ok(
      res.status === 405 || res.status === 404,
      `Method PUT on /api/status should return 405 or 404, got ${res.status}`
    );
  });

  it('T2.6.6 - should serve embedded SPA HTML fallback for non-API client-side routes', async () => {
    const res = await http.get('/dashboard');
    assertStatusCode(res, 200, 'SPA fallback navigation');

    const ctype = res.headers.get('content-type') || '';
    assert.ok(ctype.includes('text/html'), `Expected text/html for SPA fallback, got '${ctype}'`);
    assert.ok(res.rawBody.includes('<div id="root">'), 'Must contain SPA mount point');
  });
});
