/**
 * Test Environment & Configuration
 * Provides base URLs, ports, timeouts, and SLA thresholds.
 */

export const config = {
  // Base URL for the ForgeHub daemon under test
  baseURL: process.env.FORGEHUB_URL || `http://127.0.0.1:${process.env.FORGEHUB_TEST_PORT || '8888'}`,

  // Default port for internal mock server if spawned
  testPort: parseInt(process.env.FORGEHUB_TEST_PORT || '8888', 10),

  // Standard latency SLA threshold in milliseconds (ORIGINAL_REQUEST.md: < 50ms)
  slaThresholdMs: parseInt(process.env.FORGEHUB_SLA_MS || '50', 10),

  // Default request timeout in milliseconds
  requestTimeoutMs: parseInt(process.env.FORGEHUB_TIMEOUT || '5000', 10),

  // Pre-flight memory guard threshold in MB (ORIGINAL_REQUEST.md: 300 MB)
  ramGuardThresholdMb: 300,

  // Wi-Fi 60-second contingency rollback timeout
  rollbackTimeoutSec: 60,

  // Debug output flag
  debug: process.env.FORGEHUB_DEBUG === '1',
};

export function getBaseURL() {
  return config.baseURL;
}

export function isLocalSpawn() {
  return !process.env.FORGEHUB_URL;
}
