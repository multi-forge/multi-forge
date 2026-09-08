import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertJSONHeader } from '../harness/assertions.mjs';

describe('Tier 2: Pre-Flight Memory Guard Boundary Tests (< 300 MB Threshold)', () => {
  it('T2.1.1 - should strictly block module launch with HTTP 422 when free RAM < 300 MB (240 MB)', async () => {
    const res = await http.post('/api/modules/mina-ia/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '240' },
    });

    assertStatusCode(res, 422, 'Start blocked under 240 MB RAM');
    assertJSONHeader(res);
    assert.equal(res.data.code, 'INSUFFICIENT_MEMORY');
    assert.equal(res.data.available_ram_mb, 240);
    assert.equal(res.data.threshold_mb, 300);
  });

  it('T2.1.2 - should strictly block module launch at lower boundary of 299 MB free RAM', async () => {
    const res = await http.post('/api/modules/mina-ia/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '299' },
    });

    assertStatusCode(res, 422, 'Start blocked at 299 MB boundary');
    assert.equal(res.data.code, 'INSUFFICIENT_MEMORY');
    assert.equal(res.data.available_ram_mb, 299);
  });

  it('T2.1.3 - should permit module launch at exactly 300 MB boundary for low-footprint module', async () => {
    // Stop module first if running
    await http.post('/api/modules/mina-ia/stop');

    const res = await http.post('/api/modules/mina-ia/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '300' },
    });

    assertStatusCode(res, 200, 'Permit start at 300 MB boundary');
    assert.equal(res.data.status, 'running');

    // Clean up
    await http.post('/api/modules/mina-ia/stop');
  });

  it('T2.1.4 - should reject launch when module requirement exceeds available RAM even if above 300 MB', async () => {
    // web-scraping requires 512 MB. Simulate 400 MB (which is > 300 MB guard, but < 512 MB required)
    const res = await http.post('/api/modules/web-scraping/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '400' },
    });

    assertStatusCode(res, 422, 'Module requirement exceeds available memory');
    assert.equal(res.data.code, 'INSUFFICIENT_MEMORY');
    assert.equal(res.data.available_ram_mb, 400);
    assert.equal(res.data.required_ram_mb, 512);
  });

  it('T2.1.5 - should succeed when free memory safely exceeds module requirement', async () => {
    const res = await http.post('/api/modules/web-scraping/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '1024' },
    });

    assertStatusCode(res, 200, 'Launch under 1024 MB free RAM');
    assert.equal(res.data.status, 'running');

    // Clean up
    await http.post('/api/modules/web-scraping/stop');
  });

  it('T2.1.6 - should return structured error message guiding user to free memory', async () => {
    const res = await http.post('/api/modules/mina-ia/start', null, {
      headers: { 'X-Debug-Simulate-Memory': '150' },
    });

    assertStatusCode(res, 422);
    assert.ok(
      res.data.message.includes('300 MB') || res.data.message.includes('insuficiente'),
      `Expected user guidance in error message, got: '${res.data.message}'`
    );
  });
});
