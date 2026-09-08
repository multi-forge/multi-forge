# ForgeHub 4-Tier Opaque-Box E2E Testing Infrastructure

**Author:** teamwork_preview_test_writer  
**Date:** 2026-09-05  
**Target Platform:** ForgeOS 1.2.0 (Armbian Linux / Linux 6.18, ARM64) & Windows Dev Workstation  
**Execution Runtime:** Zero external dependencies (Native Node.js `node:test` & standard library)  
**Status:** AUTHORITATIVE & COMPLETE  

---

## 1. Test Philosophy & Principles

ForgeHub is an enterprise-grade, single-binary edge appliance management platform and module store designed for resource-constrained edge hardware (BTV Express E10, Amlogic S905X2, 2GB LPDDR4, 8GB eMMC).

The E2E Testing Track strictly adheres to four foundational principles:

1. **Requirement-Driven Verification:**
   All assertions and contracts are derived directly from `ORIGINAL_REQUEST.md`, `PROJECT.md`, and authoritative specification reports (`spec_report.md`, `frontend_test_survey.md`). Tests exercise user acceptance criteria rather than coupling to internal implementation details.

2. **Opaque-Box Testing:**
   ForgeHub is tested as an external black-box appliance. Tests interact solely through public interfaces:
   - REST API endpoints (`/api/status`, `/api/metrics`, `/api/scan`, `/api/modules`, `/api/store`, `/api/services`)
   - Real-time Server-Sent Events (SSE) streams (`/api/events`, `/api/modules/{id}/logs/stream`)
   - Dynamic Reverse Proxy routes (`/app/{id}/*`)
   - HTTP response codes, latency SLAs (< 50ms), and P0 security redactions (`***`)

3. **Progressive Testability:**
   Tests are layered across progressive milestones. Tier 1 isolates individual features and APIs so they can pass against early milestones (M1 core daemon, persistence, and telemetry), while higher tiers validate subsequent milestones (M2 module runner, M3 reverse proxy, M4 hardware connectivity) and full system integration.

4. **Zero External Dependencies:**
   The test suite utilizes the native Node.js test runner (`node:test`) and assertion library (`node:assert`), requiring **zero** external npm package installations (`node_modules` not required). This guarantees instant, deterministic execution across both Windows development workstations and Linux ARM64 target boards.

---

## 2. Feature Inventory & 4-Tier Test Mapping

| Feature ID | Feature Name | Mapped Tier | Primary Endpoint / Interface | Key Contract / SLA |
|---|---|---|---|---|
| **FEAT-01** | Core Status API | Tier 1, 2 | `GET /api/status` | SLA < 50ms, returns AP/Client status, device model, uptime |
| **FEAT-02** | Telemetry Metrics API | Tier 1, 3 | `GET /api/metrics` | SLA < 50ms, CPU, RAM, thermal sensor (°C), disk, network |
| **FEAT-03** | SSE Telemetry Broker | Tier 1, 2, 3 | `GET /api/events` | `text/event-stream`, 1000ms cadence, clean client disconnect |
| **FEAT-04** | Idle Memory Footprint | Tier 1 | Process RSS / API | Reported memory <= 15 MB RSS idle daemon target |
| **FEAT-05** | Module Management API | Tier 1, 2, 3 | `/api/modules/*` | List, detail, start, stop, state transitions |
| **FEAT-06** | Edge Store Catalog | Tier 1, 4 | `/api/store` | Manifests with `x-forgehub`/`x-casaos` schemas, RAM/disk reqs |
| **FEAT-07** | Smart Reverse Proxy | Tier 1, 2, 3, 4 | `/app/{id}/*` | Dynamic routing, prefix stripping, header injection |
| **FEAT-08** | Wi-Fi Provisioning & Scan | Tier 1, 2, 4 | `/api/scan`, `/api/ap` | WPA2-PSK & 802.1X EAP detection, RSSI signal ranking |
| **FEAT-09** | P0 Security Redaction | Tier 1, 2 | All API payloads | Automatic masking (`***`) of passwords, PSKs, tokens, secrets |
| **FEAT-10** | Pre-Flight Memory Guard | Tier 2, 4 | Header / Check | Free RAM < 300 MB blocks launch with HTTP 422 |
| **FEAT-11** | 60s Contingency Rollback | Tier 2, 4 | `/api/provision`, `/api/reset` | Watchdog timer reverts to AP on association/DHCP failure |
| **FEAT-12** | Input Validation Integrity | Tier 2 | `/api/provision` | SSID escaping, password length boundaries (8-63 chars), hex keys |
| **FEAT-13** | Route & Port Collisions | Tier 2 | `/api/modules/{id}/register` | Prevents route collisions and duplicate module registration |
| **FEAT-14** | High-Frequency SSE Bursts | Tier 2, 3 | `/api/events` | Rapid connect/disconnect bursts, concurrent subscriber load |
| **FEAT-15** | Error Routing & Fallbacks | Tier 2 | `/*` | 404/503 structured JSON for API, SPA routing fallback |
| **FEAT-16** | Cross-Feature Concurrency | Tier 3 | Concurrent endpoints | Telemetry streaming + module install + Wi-Fi scan in parallel |
| **FEAT-17** | End-to-End User Journeys | Tier 4 | Multi-step workflows | First-boot onboarding, store deploy, RAM recovery, live logs |

---

## 3. Test Architecture & Directory Layout

```
ForgeHub/
├── TEST_INFRA.md                       # This document (Infrastructure & Tier Mapping)
├── TEST_READY.md                       # Readiness validation & execution summary
└── test/
    └── e2e/                            # Opaque-box E2E test suite
        ├── harness/                    # Test harness, clients, assertions & runner
        │   ├── config.mjs              # Environment & port configuration
        │   ├── http_client.mjs         # SLA-timed HTTP client with latency measurement
        │   ├── sse_client.mjs          # EventSource client with message buffering
        │   ├── assertions.mjs          # Domain-specific assertions (SLA, memory, redaction)
        │   ├── test_server.mjs         # Integrated test server implementing API contracts
        │   └── runner.mjs              # Custom test runner with Tier filtering & reporting
        ├── tier1_features/             # Tier 1: Isolated feature & contract tests
        │   ├── status.test.mjs         # /api/status contract and latency (< 50ms)
        │   ├── metrics.test.mjs        # /api/metrics schema, values, latency (< 50ms)
        │   ├── events.test.mjs         # /api/events SSE stream structure
        │   ├── memory.test.mjs         # Memory footprint & idle behavior
        │   ├── modules.test.mjs        # Module CRUD and control endpoints
        │   ├── store.test.mjs          # Store catalog endpoints
        │   ├── proxy.test.mjs          # Reverse proxy routing (/app/{id})
        │   ├── wifi.test.mjs           # Wi-Fi scan and status endpoints
        │   └── security.test.mjs       # P0 security redaction (*** masking)
        ├── tier2_boundaries/           # Tier 2: Boundary & error condition tests
        │   ├── ram_guard.test.mjs      # Pre-flight Memory Guard (< 300MB -> HTTP 422)
        │   ├── rollback.test.mjs       # 60s contingency rollback behavior
        │   ├── wifi_inputs.test.mjs    # Invalid SSIDs, passwords, special chars, 63 chars
        │   ├── collisions.test.mjs     # Duplicate registration & port collisions
        │   ├── sse_bursts.test.mjs     # High-frequency SSE bursts & rapid disconnects
        │   └── error_routes.test.mjs   # 404, 503, invalid JSON, method not allowed
        ├── tier3_pairwise/             # Tier 3: Concurrency & interaction tests
        │   ├── module_telemetry.test.mjs # Concurrent module install + SSE streaming
        │   ├── wifi_metrics.test.mjs     # Simultaneous Wi-Fi scan + metrics polling
        │   └── proxy_transitions.test.mjs# Reverse proxy routing during start/stop
        └── tier4_workloads/            # Tier 4: Real-world user journeys
            ├── onboarding_journey.test.mjs # Edge appliance first-boot onboarding
            ├── store_deploy_journey.test.mjs# App store browse -> RAM check -> install
            ├── ram_guard_recovery.test.mjs  # RAM lockout -> stop service -> recovery
            ├── proxy_ingress_journey.test.mjs# Proxy registration -> access -> teardown
            └── live_logging_journey.test.mjs# Live log streaming during lifecycle
```

---

## 4. Coverage Thresholds & Requirements

### Tier 1: Feature & Contract Tests (Threshold: $\ge 5$ tests per feature)
- **Status API:** $\ge 5$ tests (Schema, <50ms latency, headers, IPv4 validation, uptime monotonicity)
- **Metrics API:** $\ge 5$ tests (Schema, <50ms latency, thermal range, RAM coherence, CPU bounds)
- **SSE Broker:** $\ge 5$ tests (MIME headers, immediate event, event format, JSON parse, clean disconnect)
- **Memory & Idle:** $\ge 5$ tests (Reported RAM, stability under repeated load, baseline RSS, GC stability, total RAM profile)
- **Modules API:** $\ge 5$ tests (List modules, manifest schema, module detail, start, stop, log endpoint)
- **Store Catalog:** $\ge 5$ tests (Catalog array, manifest metadata, category filtering, resource tags, reference apps)
- **Reverse Proxy:** $\ge 5$ tests (Route registration, request forwarding, prefix stripping, header enrichment, deregistration)
- **Wi-Fi & AP:** $\ge 5$ tests (Scan results, RSSI validation, encryption flags, AP config, scan SLA)
- **P0 Security:** $\ge 5$ tests (Password redaction in status, provision masking, PSK masking, recursive redaction, EAP masking)

### Tier 2: Boundary Value & Error Condition Tests (Threshold: $\ge 5$ tests per feature)
- **Pre-Flight Memory Guard:** $\ge 5$ tests (RAM < 300MB -> HTTP 422, structured error payload, 299MB blocked boundary, 300MB allowed boundary, 300-500MB soft caution, module-specific RAM overflow)
- **60s Contingency Rollback:** $\ge 5$ tests (Provision acknowledgment contract, association timeout trigger, phase transition tracking, failure reason recording, force reset to AP)
- **Input Validation Integrity:** $\ge 5$ tests (Empty SSID rejection, PSK < 8 chars rejection, PSK > 63 chars rejection, 63-char valid boundary, 64-hex key, special characters escaping, missing EAP identity)
- **Collisions & Prevention:** $\ge 5$ tests (Duplicate route conflict, duplicate port conflict, invalid target URL, duplicate module ID, mutually exclusive modules)
- **SSE Bursts & Disconnects:** $\ge 5$ tests (20 rapid sequential connections, 10 concurrent subscribers, abrupt client abort, multi-stream concurrency, heartbeat integrity)
- **Error Routing & Fallbacks:** $\ge 5$ tests (Unknown module 404, stopped module 503, proxy target down 502/503, invalid JSON body 400, method not allowed 405, SPA HTML fallback)

### Tier 3: Pairwise & Concurrency Tests
- Cross-feature interactions exercising multiple asynchronous subsystems simultaneously:
  1. Concurrent module install/start while streaming continuous telemetry SSE events
  2. Simultaneous Wi-Fi network scanning while high-frequency polling metrics
  3. Reverse proxy traffic routing during module start/stop lifecycle transitions
  4. Concurrent multi-client metrics polling stress test (50 concurrent requests)
  5. Provisioning status queries during active SSE stream

### Tier 4: Real-World Workloads & Journeys (Threshold: $\ge 5$ complete scenarios)
1. **Edge Appliance First-Boot Onboarding**: Standalone AP mode -> TV QR code scanned -> Portal accessed -> Network scanned -> Eduroam/PSK provisioned -> 60s watchdog acknowledged -> Connected state verified.
2. **App Store Browsing & Safe Deployment**: Browse store catalog -> Filter by category -> Inspect RAM requirements -> Verify available memory -> Trigger one-click install -> Verify running status.
3. **Pre-Flight RAM Guard Lockout & Recovery**: Module install attempted under memory pressure (< 300MB) -> Blocked with HTTP 422 -> User stops running module -> RAM frees up -> Re-attempt install succeeds.
4. **Smart Reverse Proxy Module Ingress**: Module launches -> Dynamic route registered -> Reverse proxy routes requests with stripped prefix -> Module stops -> Route cleanly deregistered -> Subsequent requests return 503.
5. **Live Log Streaming During Module Lifecycle**: Client connects to module log SSE stream -> Module triggered -> Real-time ANSI log lines streamed -> Terminal clean disconnect.

---

## 5. Test Runner Command & Execution Guide

### Execution Commands

```bash
# Run the entire 4-Tier E2E Test Suite (All Tiers)
node test/e2e/harness/runner.mjs

# Run specific Tier
node test/e2e/harness/runner.mjs --tier=1
node test/e2e/harness/runner.mjs --tier=2
node test/e2e/harness/runner.mjs --tier=3
node test/e2e/harness/runner.mjs --tier=4

# Run against an external ForgeHub instance (e.g. running daemon on port 8080)
FORGEHUB_URL=http://localhost:8080 node test/e2e/harness/runner.mjs

# Run using standard Node test runner directly
node --test test/e2e/**/*.test.mjs
```

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `FORGEHUB_URL` | *(auto-spawn test instance)* | Base URL of the ForgeHub daemon under test. If unset, harness automatically spawns the integrated test server. |
| `FORGEHUB_TEST_PORT` | `8888` | Port used by the integrated test server when spawned. |
| `FORGEHUB_TIMEOUT` | `5000` | Default HTTP request timeout in milliseconds. |
| `FORGEHUB_DEBUG` | `0` | Enable verbose logging of HTTP requests and SSE events. |
