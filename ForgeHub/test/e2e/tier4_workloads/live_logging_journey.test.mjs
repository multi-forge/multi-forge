import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SSEClient } from '../harness/sse_client.mjs';

describe('Tier 4: Scenario 5 - Real-Time Live Terminal Log Streaming Journey', () => {
  it('T4.5.1 - should subscribe to module logs, receive live ANSI lines, and cleanly disconnect', async () => {
    // 1. Client web terminal (@xterm/xterm) connects to module log stream
    const sse = new SSEClient('/api/modules/mina-ia/logs/stream');
    try {
      await sse.connect();
      assert.equal(sse.statusCode, 200, 'Step 1: SSE stream opened');

      // 2. Client receives real-time log lines emitted by service
      const firstLine = await sse.waitForEvent((e) => e.event === 'log', 3000);
      assert.ok(firstLine, 'Step 2: First log line received');
      assert.ok(firstLine.rawData.includes('mina-ia'), 'Log mentions service name');

      // 3. Client collects subsequent live log output
      const collected = await sse.collectEvents(2, 4000);
      assert.ok(collected.length >= 2, 'Step 3: Multi-line log output captured');

      // 4. Verify ANSI formatting or clean string structure
      for (const line of collected) {
        assert.equal(line.event, 'log');
        assert.equal(typeof line.rawData, 'string');
      }

      // 5. User closes modal / navigates away -> clean disconnect
      sse.close();
      assert.equal(sse.connected, false, 'Step 5: Clean disconnect verified');
    } finally {
      sse.close();
    }
  });
});
