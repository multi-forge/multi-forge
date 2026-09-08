/**
 * Server-Sent Events (SSE) Client
 * Connects to SSE endpoints (/api/events, /api/modules/{id}/logs/stream),
 * parses incoming events, and allows waiting for / collecting events.
 */

import { getBaseURL, config } from './config.mjs';

export class SSEClient {
  /**
   * @param {string} path - URL path (e.g. '/api/events')
   * @param {object} [options]
   */
  constructor(path, options = {}) {
    this.path = path;
    this.baseURL = options.baseURL || getBaseURL();
    this.url = `${this.baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
    this.headers = options.headers || {};
    this.controller = new AbortController();
    this.events = [];
    this.listeners = [];
    this.connected = false;
    this.closed = false;
    this.headersReceived = null;
    this.statusCode = null;
  }

  /**
   * Connect to the SSE endpoint and begin streaming.
   * @returns {Promise<SSEClient>}
   */
  async connect() {
    const res = await fetch(this.url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...this.headers,
      },
      signal: this.controller.signal,
    });

    this.statusCode = res.status;
    this.headersReceived = res.headers;

    if (res.status !== 200) {
      throw new Error(`SSE connection failed with status ${res.status}: ${await res.text()}`);
    }

    this.connected = true;
    this._startReading(res.body);
    return this;
  }

  async _startReading(readableStream) {
    if (!readableStream) return;
    const reader = readableStream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const rawMessage of parts) {
          const parsed = this._parseRawEvent(rawMessage);
          if (parsed) {
            this.events.push(parsed);
            for (const listener of this.listeners) {
              listener(parsed);
            }
          }
        }
      }
    } catch (err) {
      // AbortError is normal on client disconnect
      if (err.name !== 'AbortError' && !this.closed && config.debug) {
        console.error('[SSE Error]', err);
      }
    } finally {
      this.connected = false;
      this.closed = true;
      try {
        reader.releaseLock();
      } catch (_) {}
    }
  }

  _parseRawEvent(raw) {
    const lines = raw.split('\n');
    let eventType = 'message';
    let dataBuffer = [];
    let id = null;

    for (const line of lines) {
      if (line.startsWith(':')) {
        // Comment / ping line
        continue;
      }
      if (line.startsWith('event:')) {
        eventType = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataBuffer.push(line.substring(5).trim());
      } else if (line.startsWith('id:')) {
        id = line.substring(3).trim();
      }
    }

    if (dataBuffer.length === 0) return null;

    const rawData = dataBuffer.join('\n');
    let data = rawData;
    try {
      data = JSON.parse(rawData);
    } catch (_) {
      // Retain raw string if not JSON
    }

    return {
      event: eventType,
      data,
      rawData,
      id,
      timestamp: Date.now(),
    };
  }

  /**
   * Wait for an event matching the predicate.
   * @param {function(object): boolean} predicate
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<object>}
   */
  waitForEvent(predicate, timeoutMs = 5000) {
    // Check if already in buffer
    const existing = this.events.find(predicate);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(listener);
        reject(new Error(`Timeout (${timeoutMs}ms) waiting for matching SSE event`));
      }, timeoutMs);

      const listener = (evt) => {
        if (predicate(evt)) {
          clearTimeout(timer);
          this.removeListener(listener);
          resolve(evt);
        }
      };

      this.listeners.push(listener);
    });
  }

  /**
   * Collect up to `count` events or until timeout.
   * @param {number} count
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<Array<object>>}
   */
  async collectEvents(count, timeoutMs = 5000) {
    if (this.events.length >= count) {
      return this.events.slice(0, count);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener(listener);
        resolve([...this.events]);
      }, timeoutMs);

      const listener = () => {
        if (this.events.length >= count) {
          clearTimeout(timer);
          this.removeListener(listener);
          resolve(this.events.slice(0, count));
        }
      };

      this.listeners.push(listener);
    });
  }

  removeListener(fn) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }

  /**
   * Cleanly disconnect the SSE stream.
   */
  close() {
    this.closed = true;
    this.connected = false;
    this.controller.abort();
  }
}
