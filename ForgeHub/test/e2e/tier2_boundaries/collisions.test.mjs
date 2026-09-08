import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 2: Route Collisions and Duplicate Registration Prevention', () => {
  it('T2.4.1 - should register primary route for module successfully', async () => {
    const res = await http.post('/api/modules/mina-ia/register', {
      proxy_path: '/app/voice-portal',
      target_url: 'http://127.0.0.1:5000',
    });

    assertStatusCode(res, 200, 'Primary route registration');
    assert.equal(res.data.registered, '/app/voice-portal');
  });

  it('T2.4.2 - should reject conflicting route registration by another module with HTTP 409 Conflict', async () => {
    // web-scraping attempts to register the same path '/app/voice-portal'
    const res = await http.post('/api/modules/web-scraping/register', {
      proxy_path: '/app/voice-portal',
      target_url: 'http://127.0.0.1:8000',
    });

    assertStatusCode(res, 409, 'Route collision rejection');
    assert.equal(res.data.error, 'route_collision');
    assert.ok(
      res.data.message.includes('already registered'),
      `Expected collision explanation, got: '${res.data.message}'`
    );
  });

  it('T2.4.3 - should reject registration with missing proxy_path or target_url with HTTP 400', async () => {
    const res = await http.post('/api/modules/mina-ia/register', {
      target_url: 'http://127.0.0.1:5000',
      // proxy_path missing
    });

    assertStatusCode(res, 400, 'Missing proxy_path');
  });

  it('T2.4.4 - should reject registration for unknown module ID with HTTP 404', async () => {
    const res = await http.post('/api/modules/non-existent-module/register', {
      proxy_path: '/app/ghost',
      target_url: 'http://127.0.0.1:9999',
    });

    assertStatusCode(res, 404, 'Unknown module registration');
  });

  it('T2.4.5 - should allow the owning module to update/re-register its own route', async () => {
    const res = await http.post('/api/modules/mina-ia/register', {
      proxy_path: '/app/voice-portal',
      target_url: 'http://127.0.0.1:5001', // updated port
    });

    assertStatusCode(res, 200, 'Idempotent re-registration by owner');
    assert.equal(res.data.ok, true);

    // Clean up route
    await http.post('/api/modules/mina-ia/deregister');
  });
});
