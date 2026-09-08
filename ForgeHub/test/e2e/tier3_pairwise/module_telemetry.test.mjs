import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { http } from '../harness/http_client.mjs';
import { SSEClient } from '../harness/sse_client.mjs';
import { assertStatusCode } from '../harness/assertions.mjs';

describe('Tier 3: Pairwise - Concurrent Module Lifecycle and Telemetry SSE Streaming', () => {
  it('T3.1.1 - should maintain uninterrupted telemetry SSE stream during module start/stop lifecycle', async () => {
    const sse = new SSEClient('/api/events');
    try {
      await sse.connect();
      // Wait for initial event
      await sse.waitForEvent((e) => e.event === 'telemetry', 2000);

      // Concurrently trigger module start
      const startPromise = http.post('/api/modules/mina-ia/start');

      // Ensure SSE continues streaming during start
      const midEvent = await sse.waitForEvent((e) => e.event === 'telemetry', 3000);
      assert.ok(midEvent, 'Telemetry event must arrive during module launch');

      const startRes = await startPromise;
      assertStatusCode(startRes, 200);

      // Concurrently trigger module stop
      const stopPromise = http.post('/api/modules/mina-ia/stop');

      const endEvent = await sse.waitForEvent((e) => e.event === 'telemetry', 3000);
      assert.ok(endEvent, 'Telemetry event must arrive during module shutdown');

      const stopRes = await stopPromise;
      assertStatusCode(stopRes, 200);
    } finally {
      sse.close();
    }
  });

  it('T3.1.2 - should not corrupt telemetry metric payloads under concurrent module commands', async () => {
    const sse = new SSEClient('/api/events');
    try {
      await sse.connect();

      // Launch 5 rapid status and module checks concurrently with SSE collection
      const operations = [
        http.get('/api/modules/mina-ia'),
        http.get('/api/status'),
        http.get('/api/modules/web-scraping'),
        http.get('/api/metrics'),
        sse.collectEvents(2, 3000),
      ];

      const [, , , , events] = await Promise.all(operations);
      assert.ok(events.length >= 1, 'Events collected safely during concurrent requests');

      for (const evt of events) {
        assert.equal(evt.event, 'telemetry');
        assert.equal(typeof evt.data.cpu_percent, 'number');
        assert.equal(typeof evt.data.ram_free_mb, 'number');
      }
    } finally {
      sse.close();
    }
  });
});
