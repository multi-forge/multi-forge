import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { SSEClient } from '../harness/sse_client.mjs';
import { assertStatusCode, assertJSONHeader } from '../harness/assertions.mjs';

describe('Tier 1: Module Management Endpoints (/api/modules)', () => {
  it('T1.5.1 - should list registered modules via GET /api/modules', async () => {
    const res = await http.get('/api/modules');
    assertStatusCode(res, 200, 'GET /api/modules');
    assertJSONHeader(res);

    assert.ok(Array.isArray(res.data.modules), 'modules must be an array');
    assert.ok(res.data.modules.length >= 1, 'modules must contain at least 1 registered module');
  });

  it('T1.5.2 - should enforce module manifest schema requirements', async () => {
    const res = await http.get('/api/modules');
    const modules = res.data.modules;

    for (const mod of modules) {
      assert.ok(mod.id, 'Module must have id');
      assert.ok(mod.name, 'Module must have name');
      assert.ok(['compose', 'systemd'].includes(mod.type), `Module type must be compose or systemd, got '${mod.type}'`);
      assert.equal(typeof mod.min_ram_mb, 'number', 'min_ram_mb must be number');
      assert.ok(['running', 'stopped', 'error', 'installing'].includes(mod.status), `Invalid status '${mod.status}'`);
    }
  });

  it('T1.5.3 - should return single module detail via GET /api/modules/{id}', async () => {
    const res = await http.get('/api/modules/mina-ia');
    assertStatusCode(res, 200, 'GET /api/modules/mina-ia');

    const mod = res.data;
    assert.equal(mod.id, 'mina-ia');
    assert.equal(mod.type, 'systemd');
    assert.equal(typeof mod.port, 'number');
  });

  it('T1.5.4 - should start a stopped module via POST /api/modules/{id}/start', async () => {
    const res = await http.post('/api/modules/mina-ia/start');
    assertStatusCode(res, 200, 'POST /api/modules/mina-ia/start');
    assert.equal(res.data.status, 'running');

    // Verify detail reflects running state
    const detail = await http.get('/api/modules/mina-ia');
    assert.equal(detail.data.status, 'running');
  });

  it('T1.5.5 - should stop a running module via POST /api/modules/{id}/stop', async () => {
    const res = await http.post('/api/modules/mina-ia/stop');
    assertStatusCode(res, 200, 'POST /api/modules/mina-ia/stop');
    assert.equal(res.data.status, 'stopped');

    // Verify detail reflects stopped state
    const detail = await http.get('/api/modules/mina-ia');
    assert.equal(detail.data.status, 'stopped');
  });

  it('T1.5.6 - should stream live logs via GET /api/modules/{id}/logs/stream', async () => {
    const client = new SSEClient('/api/modules/mina-ia/logs/stream');
    try {
      await client.connect();
      assert.equal(client.statusCode, 200);

      const logEvent = await client.waitForEvent((e) => e.event === 'log', 3000);
      assert.ok(logEvent, 'Expected log event from module log stream');
      assert.ok(logEvent.rawData.length > 0, 'Log line must contain text');
    } finally {
      client.close();
    }
  });
});
