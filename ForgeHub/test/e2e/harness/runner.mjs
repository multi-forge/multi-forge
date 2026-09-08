#!/usr/bin/env node
/**
 * ForgeHub 4-Tier E2E Test Suite Runner
 * Usage:
 *   node test/e2e/harness/runner.mjs [--tier=1|2|3|4|all] [--url=http://...]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { ForgeHubTestServer } from './test_server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const e2eRoot = path.resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
let selectedTier = 'all';
let customUrl = null;

for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    selectedTier = arg.split('=')[1].trim();
  } else if (arg.startsWith('--url=')) {
    customUrl = arg.split('=')[1].trim();
  } else if (arg.startsWith('--sla=')) {
    process.env.FORGEHUB_SLA_MS = arg.split('=')[1].trim();
  }
}

if (customUrl) {
  process.env.FORGEHUB_URL = customUrl;
}

// Map tiers to directories
const tierDirs = {
  1: path.join(e2eRoot, 'tier1_features'),
  2: path.join(e2eRoot, 'tier2_boundaries'),
  3: path.join(e2eRoot, 'tier3_pairwise'),
  4: path.join(e2eRoot, 'tier4_workloads'),
};

function getTestFilesForTier(tier) {
  const dir = tierDirs[tier];
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.test.mjs') || file.endsWith('.test.js'))
    .map((file) => path.join(dir, file));
}

let filesToRun = [];
if (selectedTier === 'all') {
  for (const t of [1, 2, 3, 4]) {
    filesToRun.push(...getTestFilesForTier(t));
  }
} else {
  filesToRun = getTestFilesForTier(selectedTier);
}

if (filesToRun.length === 0) {
  console.error(`[ERROR] No test files found for tier '${selectedTier}'`);
  process.exit(1);
}

console.log('='.repeat(70));
console.log('   FORGEHUB 4-TIER OPAQUE-BOX E2E TEST SUITE');
console.log('='.repeat(70));
console.log(`Execution Mode : ${process.env.FORGEHUB_URL ? 'Remote Daemon' : 'Integrated Test Server'}`);
console.log(`Target Tier    : Tier ${selectedTier.toUpperCase()}`);
console.log(`Files in Scope : ${filesToRun.length} files`);
console.log('='.repeat(70));

let testServer = null;

async function main() {
  if (!process.env.FORGEHUB_URL) {
    const testPort = parseInt(process.env.FORGEHUB_TEST_PORT || '8888', 10);
    testServer = new ForgeHubTestServer(testPort);
    const serverUrl = await testServer.start();
    process.env.FORGEHUB_URL = serverUrl;
    console.log(`[INFO] Integrated test server spawned at: ${serverUrl}\n`);
  } else {
    console.log(`[INFO] Testing against external ForgeHub at: ${process.env.FORGEHUB_URL}\n`);
  }

  let failedTests = 0;

  try {
    const testStream = run({
      files: filesToRun,
      concurrency: false, // Run sequentially for predictable state transitions
    });

    testStream.on('test:fail', () => {
      failedTests++;
    });

    await new Promise((resolve) => {
      const reporter = testStream.compose(new spec());
      reporter.pipe(process.stdout);
      reporter.on('end', resolve);
      testStream.on('end', resolve);
    });
  } finally {
    if (testServer) {
      await testServer.stop();
      console.log('\n[INFO] Integrated test server cleanly stopped.');
    }
  }

  console.log('\n' + '='.repeat(70));
  if (failedTests > 0) {
    console.error(`❌ TEST SUITE FAILED: ${failedTests} failure(s) detected.`);
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY.');
    console.log('='.repeat(70));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[FATAL] Runner execution error:', err);
  if (testServer) testServer.stop();
  process.exit(1);
});
