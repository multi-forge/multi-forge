/**
 * Domain-Specific Assertions for ForgeHub E2E Tests
 */

import assert from 'node:assert/strict';
import { config } from './config.mjs';

/**
 * Asserts response latency complies with SLA (< 50ms by default).
 * @param {number} latencyMs
 * @param {number} [maxAllowedMs=50]
 * @param {string} [label='SLA']
 */
export function assertSLA(latencyMs, maxAllowedMs = config.slaThresholdMs, label = 'Endpoint SLA') {
  assert.ok(
    latencyMs <= maxAllowedMs,
    `${label} violation: response took ${latencyMs}ms, expected <= ${maxAllowedMs}ms`
  );
}

/**
 * Asserts HTTP status code matches expected value.
 * @param {{ status: number, rawBody: string }} res
 * @param {number} expectedStatus
 * @param {string} [context]
 */
export function assertStatusCode(res, expectedStatus, context = '') {
  assert.equal(
    res.status,
    expectedStatus,
    `HTTP Status mismatch ${context ? `(${context})` : ''}: got ${res.status}, expected ${expectedStatus}. Body: ${res.rawBody}`
  );
}

/**
 * Asserts Content-Type is application/json.
 * @param {{ headers: Headers }} res
 */
export function assertJSONHeader(res) {
  const ctype = res.headers.get('content-type') || '';
  assert.ok(
    ctype.includes('application/json'),
    `Expected application/json header, received '${ctype}'`
  );
}

/**
 * Recursively asserts that sensitive fields are redacted or masked with '***'.
 * @param {any} value
 * @param {string} [path='root']
 */
export function assertRedacted(value, path = 'root') {
  const sensitivePatterns = /^(password|psk|secret|passphrase|private_key)$/i;

  if (value === null || value === undefined) return;

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      value.forEach((item, idx) => assertRedacted(item, `${path}[${idx}]`));
    } else {
      for (const [key, val] of Object.entries(value)) {
        const currentPath = `${path}.${key}`;
        if (sensitivePatterns.test(key)) {
          if (typeof val === 'string') {
            assert.ok(
              val === '***' || val.includes('***') || val === '',
              `P0 Security Redaction violation at ${currentPath}: sensitive key exposed value '${val}'`
            );
          }
        }
        assertRedacted(val, currentPath);
      }
    }
  }
}

/**
 * Asserts telemetry metrics schema coherence and reasonable ranges.
 * @param {object} metrics
 */
export function assertMemoryCoherence(metrics) {
  assert.ok(metrics, 'Metrics object must not be null');

  assert.equal(typeof metrics.cpu_percent, 'number', 'cpu_percent must be number');
  assert.ok(metrics.cpu_percent >= 0 && metrics.cpu_percent <= 100, `cpu_percent ${metrics.cpu_percent} out of range [0, 100]`);

  assert.equal(typeof metrics.ram_total_mb, 'number', 'ram_total_mb must be number');
  assert.equal(typeof metrics.ram_used_mb, 'number', 'ram_used_mb must be number');
  assert.equal(typeof metrics.ram_free_mb, 'number', 'ram_free_mb must be number');

  assert.ok(metrics.ram_total_mb > 0, 'ram_total_mb must be > 0');
  assert.ok(metrics.ram_used_mb >= 0, 'ram_used_mb must be >= 0');
  assert.ok(metrics.ram_free_mb >= 0, 'ram_free_mb must be >= 0');

  // Sum should not exceed total plus reasonable buffer
  const sum = metrics.ram_used_mb + metrics.ram_free_mb;
  assert.ok(
    sum <= metrics.ram_total_mb + 200,
    `Memory accounting anomaly: used (${metrics.ram_used_mb}) + free (${metrics.ram_free_mb}) = ${sum} exceeds total (${metrics.ram_total_mb})`
  );

  if (metrics.temp_celsius !== undefined) {
    assert.equal(typeof metrics.temp_celsius, 'number', 'temp_celsius must be number');
    assert.ok(
      metrics.temp_celsius >= 10 && metrics.temp_celsius <= 110,
      `temp_celsius ${metrics.temp_celsius} outside realistic SoC thermal range [10, 110]`
    );
  }
}
