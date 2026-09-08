import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { assertStatusCode, assertJSONHeader, assertSLA } from '../harness/assertions.mjs';

describe('Tier 1: Store Catalog Engine Endpoints (/api/store)', () => {
  it('T1.6.1 - should return store catalog array via GET /api/store', async () => {
    const res = await http.get('/api/store');
    assertStatusCode(res, 200, 'GET /api/store');
    assertJSONHeader(res);

    assert.ok(Array.isArray(res.data.catalog), 'catalog must be an array');
    assert.ok(res.data.catalog.length >= 2, 'catalog must contain at least 2 apps');
  });

  it('T1.6.2 - should enforce store manifest metadata schema', async () => {
    const res = await http.get('/api/store');
    const catalog = res.data.catalog;

    for (const app of catalog) {
      assert.ok(app.id, 'App must have id');
      assert.ok(app.name, 'App must have name');
      assert.ok(app.category, 'App must have category');
      assert.ok(app.description, 'App must have description');
      assert.equal(typeof app.min_ram_mb, 'number', 'min_ram_mb must be number');
      assert.ok(app.min_ram_mb > 0, 'min_ram_mb must be positive');
    }
  });

  it('T1.6.3 - should include reference apps Mina IA and Web Scraping in catalog', async () => {
    const res = await http.get('/api/store');
    const ids = res.data.catalog.map((a) => a.id);

    assert.ok(ids.includes('mina-ia'), 'Catalog must include Mina IA reference app');
    assert.ok(ids.includes('web-scraping'), 'Catalog must include Web Scraping reference app');
  });

  it('T1.6.4 - should validate app categories are standardized', async () => {
    const res = await http.get('/api/store');
    const validCategories = ['ai', 'data', 'tools', 'iot', 'media', 'network'];

    for (const app of res.data.catalog) {
      assert.ok(
        validCategories.includes(app.category),
        `Unexpected category '${app.category}' for app '${app.id}'`
      );
    }
  });

  it('T1.6.5 - should respond within 50ms latency SLA', async () => {
    const res = await http.get('/api/store');
    assertStatusCode(res, 200);
    assertSLA(res.latencyMs, 50, '/api/store SLA');
  });
});
