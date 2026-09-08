import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SSEClient } from '../harness/sse_client.mjs';
import { assertMemoryCoherence } from '../harness/assertions.mjs';

describe('Tier 1: /api/events Real-Time SSE Stream Structure', () => {
  it('T1.3.1 - should return correct SSE MIME type and headers', async () => {
    const client = new SSEClient('/api/events');
    try {
      await client.connect();
      assert.equal(client.statusCode, 200);
      const contentType = client.headersReceived.get('content-type') || '';
      assert.ok(
        contentType.includes('text/event-stream'),
        `Expected text/event-stream, got: '${contentType}'`
      );
    } finally {
      client.close();
    }
  });

  it('T1.3.2 - should deliver an immediate telemetry event on initial connection', async () => {
    const client = new SSEClient('/api/events');
    try {
      await client.connect();
      const firstEvent = await client.waitForEvent((e) => e.event === 'telemetry', 3000);
      assert.ok(firstEvent, 'Immediate telemetry event must be received');
      assert.equal(firstEvent.event, 'telemetry');
    } finally {
      client.close();
    }
  });

  it('T1.3.3 - should emit valid JSON payload in SSE data field', async () => {
    const client = new SSEClient('/api/events');
    try {
      await client.connect();
      const event = await client.waitForEvent((e) => e.event === 'telemetry', 3000);
      assert.equal(typeof event.data, 'object', 'SSE data field must be parsed JSON object');
      assert.ok(event.data !== null, 'SSE data must not be null');
    } finally {
      client.close();
    }
  });

  it('T1.3.4 - should satisfy memory and telemetry schema inside SSE payload', async () => {
    const client = new SSEClient('/api/events');
    try {
      await client.connect();
      const event = await client.waitForEvent((e) => e.event === 'telemetry', 3000);
      assertMemoryCoherence(event.data);
    } finally {
      client.close();
    }
  });

  it('T1.3.5 - should stream multiple consecutive events over time', async () => {
    const client = new SSEClient('/api/events');
    try {
      await client.connect();
      const events = await client.collectEvents(2, 4000);
      assert.ok(events.length >= 2, `Expected at least 2 events within 4s, received ${events.length}`);
    } finally {
      client.close();
    }
  });

  it('T1.3.6 - should cleanly disconnect when client closes stream', async () => {
    const client = new SSEClient('/api/events');
    await client.connect();
    await client.waitForEvent((e) => e.event === 'telemetry', 2000);
    // Close stream
    client.close();
    assert.equal(client.connected, false, 'Client connection state must be closed');
  });
});
