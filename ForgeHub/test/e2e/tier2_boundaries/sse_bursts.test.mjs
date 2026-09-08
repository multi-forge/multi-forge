import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SSEClient } from '../harness/sse_client.mjs';

describe('Tier 2: High-Frequency SSE Connection Bursts and Rapid Disconnects', () => {
  it('T2.5.1 - should withstand 15 rapid sequential SSE connection and disconnect cycles', async () => {
    for (let i = 0; i < 15; i++) {
      const client = new SSEClient('/api/events');
      await client.connect();
      assert.equal(client.connected, true);
      // Immediately disconnect
      client.close();
      assert.equal(client.connected, false);
    }
  });

  it('T2.5.2 - should handle 8 concurrent SSE subscribers receiving simultaneous telemetry events', async () => {
    const clients = [];
    try {
      for (let i = 0; i < 8; i++) {
        const client = new SSEClient('/api/events');
        clients.push(client);
      }

      await Promise.all(clients.map((c) => c.connect()));

      // Verify each subscriber receives an event
      const eventPromises = clients.map((c) =>
        c.waitForEvent((e) => e.event === 'telemetry', 3000)
      );

      const results = await Promise.all(eventPromises);
      assert.equal(results.length, 8);
      for (const res of results) {
        assert.equal(res.event, 'telemetry');
        assert.ok(res.data.ram_total_mb > 0);
      }
    } finally {
      clients.forEach((c) => c.close());
    }
  });

  it('T2.5.3 - should handle abrupt client-side abort without server crashing', async () => {
    const client = new SSEClient('/api/events');
    await client.connect();

    // Abruptly abort controller mid-flight
    client.controller.abort();
    client.closed = true;

    // Verify subsequent new connection still connects cleanly
    const nextClient = new SSEClient('/api/events');
    try {
      await nextClient.connect();
      const evt = await nextClient.waitForEvent((e) => e.event === 'telemetry', 3000);
      assert.ok(evt);
    } finally {
      nextClient.close();
    }
  });

  it('T2.5.4 - should support concurrent log streams across different modules', async () => {
    const client1 = new SSEClient('/api/modules/mina-ia/logs/stream');
    const client2 = new SSEClient('/api/modules/web-scraping/logs/stream');

    try {
      await Promise.all([client1.connect(), client2.connect()]);

      const [log1, log2] = await Promise.all([
        client1.waitForEvent((e) => e.event === 'log', 3000),
        client2.waitForEvent((e) => e.event === 'log', 3000),
      ]);

      assert.ok(log1, 'Mina log event received');
      assert.ok(log2, 'Web scraping log event received');
    } finally {
      client1.close();
      client2.close();
    }
  });

  it('T2.5.5 - should maintain continuous telemetry flow after disconnect wave', async () => {
    // Connect and verify telemetry is healthy
    const client = new SSEClient('/api/events');
    try {
      await client.connect();
      const events = await client.collectEvents(2, 4000);
      assert.ok(events.length >= 2, 'Telemetry continues broadcasting smoothly');
    } finally {
      client.close();
    }
  });
});
