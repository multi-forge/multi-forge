# Project: ForgeHub

## Architecture
ForgeHub is an enterprise-grade, single-binary edge appliance management platform and module store for ForgeOS on the BTV Express E10 (Amlogic S905X2, 2GB LPDDR4, 8GB eMMC).

```
                      [ User Browser / Mobile Phone ]
                                     │
                                     ▼ HTTP :8080 / :80
 ┌────────────────────────────────────────────────────────────────────────┐
 │ ForgeHub Single Static Binary (Go 1.22+ / CGO_ENABLED=0 / arm64)       │
 │                                                                        │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ Chi Mux Router (RequestID, RealIP, Logger, Recoverer, Gzip, CORS)│  │
 │  └──────────────────────────────────────────────────────────────────┘  │
 │          │                         │                        │          │
 │          ├───► /api/*              ├───► /app/{id}/*        └──► /*    │
 │          │   ┌────────────────┐    │   ┌────────────────┐   (Embedded  │
 │          │   │ REST API & SSE │    │   │ Dynamic Reverse│   React SPA  │
 │          │   │ Event Broker   │    │   │ Proxy Pool     │   //go:embed)│
 │          │   └────────────────┘    │   └────────────────┘              │
 │          │                         │            │                      │
 │          ▼                         ▼            ▼                      │
 │  ┌─────────────────┐       ┌───────────────┐ ┌──────────────────────┐  │
 │  │ Telemetry &     │       │ Hybrid Module │ │ MultiForge Hardware: │  │
 │  │ Persistent Store│       │ Runner Engine │ │ - Wi-Fi AP/Client/60s│  │
 │  │ (bbolt +        │       │ (Compose +    │ │ - HDMI FB0 Kiosk     │  │
 │  │  gopsutil)      │       │  Systemd)     │ │ - RAM Pre-flight Grd │  │
 │  └─────────────────┘       └───────────────┘ └──────────────────────┘  │
 └────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Static Go Daemon Binary | Single static binary (`CGO_ENABLED=0 GOOS=linux GOARCH=arm64`), cross-compilable for host testing | M1 | R1 |
| 2 | Low Memory Footprint | Idle memory <= 15 MB RSS on ARM64 Linux | M1 | R1 |
| 3 | Chi HTTP Router & Middlewares | Chi router with RequestID, RealIP, Recoverer, Gzip, and CORS middlewares | M1 | R1 |
| 4 | Telemetry Engine | Real-time CPU, RAM, disk, and network metrics via gopsutil | M1 | R1 |
| 5 | Thermal Sensor Telemetry | SoC core temp read from `/sys/class/thermal/thermal_zone0/temp` (/1000.0) with mock fallback | M1 | R1 |
| 6 | SSE Event Broker | Server-Sent Events broker streaming live metrics to `/api/events` | M1 | R1 |
| 7 | Embedded KV Persistence | Pure Go `bbolt` ACID database for modules, config, and state under `/opt/multiforge/state/` | M1 | R1 |
| 8 | Core Telemetry APIs | `/api/status` and `/api/metrics` responding with < 50ms latency | M1 | R1, AC |
| 9 | Declarative Store Manifests | Support `compose.yaml` with `x-forgehub` and `x-casaos` metadata extensions | M2 | R2 |
| 10 | Directory-Based Stacks | Filesystem stacks layout under `/opt/multiforge/modules/<id>/` | M2 | R2 |
| 11 | Docker Compose Runner | Executes Compose stacks via CLI (`docker compose up/down/ps`) with log streaming | M2 | R2 |
| 12 | Native Systemd Runner | Executes native systemd units (`forge-<id>.service`) without container overhead | M2 | R2 |
| 13 | Pre-Flight Memory Guard | Strictly blocks container/module launches if free RAM < 300 MB, returning HTTP 422 | M2 | R2, AC |
| 14 | Real-Time Log Streaming | Line-buffered ANSI log streaming over SSE into web terminal | M2 | R2 |
| 15 | Store Catalog Engine | Pre-indexed edge store catalog for available apps (`/api/store`, `/api/store/{id}`) | M2 | R2 |
| 16 | Module Lifecycle APIs | CRUD & control endpoints (`/api/modules`, install, start, stop, uninstall, logs) | M2 | R2, AC |
| 17 | Native Services APIs | Control host systemd services via `/api/services` | M2 | R2 |
| 18 | Dynamic Reverse Proxy | Built-in reverse proxy (`net/http/httputil`) routing `/app/{id}/*` to internal ports | M3 | R3 |
| 19 | Portless Access | Single port 8080/80 ingress without user-facing port collisions | M3 | R3 |
| 20 | Route Lifecycle Management | Auto-registration on module start and deregistration on module stop | M3 | R3 |
| 21 | Path Prefix Stripping | Configurable prefix stripping (`x-forgehub.strip_prefix`) with header enrichment | M3 | R3 |
| 22 | WebSocket Passthrough | Reverse proxy bidirectional streaming for WebSocket handshakes | M3 | R3 |
| 23 | Autonomous Wi-Fi AP Mode | Standalone AP mode using `wpa_supplicant mode=2` on `192.168.4.1` with dnsmasq | M4 | R4 |
| 24 | Wi-Fi Client Provisioning | Support WPA2-PSK and 802.1X EAP (PEAP/TTLS eduroam) credentials builder | M4 | R4 |
| 25 | 60s Contingency Rollback | Automatic rollback to AP if client association/DHCP fails within 60s | M4 | R4 |
| 26 | Wi-Fi Provisioning APIs | `/api/scan`, `/api/provision`, and `/api/reset` with < 50ms latency | M4 | R4 |
| 27 | P0 Security Redaction | Credential shredding (`shred -u`) and secret masking (`***`) across API payloads | M4 | R4, AC |
| 28 | HDMI FB0 Direct Renderer | Direct write of 1920x1080 Full HD BGRA framebuffers to `/dev/fb0` without X11 | M4 | R4 |
| 29 | Dynamic Pairing QR Codes | Real-time QR code generation for Wi-Fi join, AP portal, and ForgeHub operational URL | M4 | R4 |
| 30 | FB0 Burn-In Protection | State machine with pixel-shifting and timeout dimming to protect displays | M4 | R4 |
| 31 | React SPA Architecture | React 18/19 + TypeScript + Vite + Tailwind CSS + Radix UI + Lucide + Zustand | M5 | R5 |
| 32 | Enterprise Dark Design System | Dark-mode-first aesthetic inspired by Red Hat PatternFly and CasaOS/Dockge, zero FOUC | M5 | R5 |
| 33 | Mobile-First Responsive UX | Pixel-perfect layouts for 360x740, 390x844, 412x915 mobile viewports and desktop | M5 | R5, AC |
| 34 | System Telemetry Dashboard UI | Live CPU, RAM, temp, disk, and network charts/sparklines via 1000ms SSE | M5 | R5 |
| 35 | Module Manager UI | Dockge-style stack management with start/stop/restart/uninstall and reverse proxy links | M5 | R5 |
| 36 | Edge Store UI | CasaOS-style visual app store with category filtering and 1-click install | M5 | R5 |
| 37 | Wi-Fi Provisioning UI | AP/Client switcher, RSSI meters, EAP forms, and 60s rollback countdown timer | M5 | R5 |
| 38 | Web Terminal Integration | `@xterm/xterm` + `@xterm/addon-fit` live log viewer with ANSI colors | M5 | R2, R5 |
| 39 | Memory Guard UI Alert | Color-coded RAM guard warning banner and install lockout on low memory | M5 | R2, R5 |
| 40 | Embedded Asset Bundling | Frontend compiled and embedded directly into Go binary via `//go:embed` | M5 | R1, R5 |
| 41 | Single Binary Integration | Complete binary build verified under Linux ARM64 and Windows/dev host | M6 | AC |
| 42 | 100% E2E Test Suite Pass | Automated test suite verifying contracts, security redaction, and error handling | M6 | AC |
| 43 | Adversarial Coverage Hardening | Tier 5 white-box stress testing and edge-case hardening | M6 | AC |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Daemon, Persistence & Telemetry | Go binary core, Chi router, bbolt KV store, gopsutil + thermal telemetry, SSE broker, `/api/status`, `/api/metrics`, `/api/events` | none | PLANNED |
| M2 | Hybrid Module Runner & Edge Store | ComposeRunner, SystemdRunner, Pre-Flight Memory Guard (<300MB), SSE log streaming, store catalog, `/api/modules/*`, `/api/store/*`, `/api/services/*` | M1 | PLANNED |
| M3 | Smart Reverse Proxy & Portless Access | Dynamic reverse proxy (`net/http/httputil`), `/app/{id}/*` routing, route lifecycle manager, prefix stripping, WebSocket passthrough | M1, M2 | PLANNED |
| M4 | MultiForge Hardware & Connectivity | Wi-Fi AP/Client (WPA2-PSK & 802.1X EAP), 60s contingency rollback, P0 security redaction, HDMI FB0 kiosk bridge (`/dev/fb0` BGRA QR generator) | M1 | PLANNED |
| M5 | Responsive Enterprise Dark Frontend SPA | React 18/19 + Vite + Tailwind + Radix + Zustand SPA, PatternFly/CasaOS dark design, mobile-first viewports, xterm live logs, Go `//go:embed` | M1, M2, M3, M4 | PLANNED |
| M6 | Final Integration & E2E Validation | Full binary packaging, 100% pass of E2E test suite (Tiers 1-4), Tier 5 adversarial coverage hardening | M1, M2, M3, M4, M5, E2E | PLANNED |

In parallel:
| Track | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track Orchestrator | Opaque-box 4-tier test harness (Tiers 1-4: Feature, Boundary, Pairwise, Real-World), publishing `TEST_READY.md` | none | PLANNED |

## Interface Contracts

### M1 Core Telemetry & KV Store ↔ M2 Module Runner
- Package: `forgehub/internal/store` & `forgehub/internal/telemetry`
- Interface:
  ```go
  type Store interface {
      GetModule(id string) (*manifest.Manifest, error)
      SaveModule(m *manifest.Manifest) error
      DeleteModule(id string) error
      ListModules() ([]*manifest.Manifest, error)
      GetModuleState(id string) (*ModuleStatus, error)
      SaveModuleState(id string, st *ModuleStatus) error
      GetConfig(key string) (string, error)
      SetConfig(key string, val string) error
      Close() error
  }

  type MemoryGuard interface {
      CheckAvailability(requiredMb int) (allowed bool, availableMb int, err error)
  }
  ```

### M2 Module Runner ↔ M3 Smart Reverse Proxy
- Package: `forgehub/internal/proxy`
- Interface:
  ```go
  type RouteManager interface {
      RegisterRoute(moduleID string, targetPort int, stripPrefix bool) error
      DeregisterRoute(moduleID string) error
      HasRoute(moduleID string) bool
      ServeHTTP(w http.ResponseWriter, r *http.Request)
  }
  ```
- Module lifecycle transitions trigger `RegisterRoute` on `running` and `DeregisterRoute` on `stopped`/`error`.

### M4 MultiForge Hardware ↔ M1 Core & M5 Frontend
- API Contracts:
  - `GET /api/scan` -> `[{"ssid":"...","rssi":-65,"security":"WPA2-PSK"}]`
  - `POST /api/provision` -> `{"ssid":"...","type":"psk"|"eap", ...}` -> `{"status":"applying","timeout_sec":60}`
  - `POST /api/reset` -> `{"status":"restored_to_ap"}`
  - `GET /api/status` -> includes `ap_active: bool`, `wifi_connected: bool`, `ip: string`, `free_ram_mb: int`

### M5 Frontend ↔ M1/M2/M3/M4 Backend
- Single binary entry point on port 8080 (and 80).
- Static SPA assets served from embedded FS (`//go:embed all:dist`).
- Path `/api/*` handled by Go Chi handlers.
- Path `/app/{id}/*` handled by Dynamic Reverse Proxy.
- Fallback route `/*` serves `index.html` (HTTP 200) for client-side HTML5 history navigation.

## Code Layout
```
ForgeHub/
├── cmd/
│   └── forgehub/
│       └── main.go                     # Single static binary entrypoint
├── internal/
│   ├── api/                            # Chi router, handlers, middleware
│   │   ├── router.go                   # Mux setup and route tree
│   │   ├── status_handler.go           # /api/status
│   │   ├── metrics_handler.go          # /api/metrics and /api/events SSE
│   │   ├── modules_handler.go          # /api/modules CRUD and lifecycle
│   │   ├── store_handler.go            # /api/store app catalog
│   │   ├── services_handler.go         # /api/services systemd
│   │   ├── wifi_handler.go             # /api/scan, /api/provision, /api/reset
│   │   └── middleware/
│   │       ├── security.go             # P0 credential redaction
│   │       └── recover.go              # Panic recovery with JSON response
│   ├── config/
│   │   └── config.go                   # Port, storage paths, defaults
│   ├── telemetry/                      # System telemetry collector & SSE broker
│   │   ├── collector.go                # gopsutil metrics
│   │   ├── thermal.go                  # /sys/class/thermal and mock fallback
│   │   └── broker.go                   # Multi-client SSE broker
│   ├── store/                          # bbolt KV persistence & catalog
│   │   ├── store.go                    # Store interface
│   │   ├── bbolt_store.go              # bbolt implementation
│   │   └── catalog.go                  # Edge store catalog loader
│   ├── runner/                         # Hybrid execution engine & memory guard
│   │   ├── runner.go                   # ModuleRunner interface & types
│   │   ├── compose_runner.go           # Docker Compose CLI execution
│   │   ├── systemd_runner.go           # Native systemd runner
│   │   ├── memory_guard.go             # Pre-flight RAM verification (< 300MB)
│   │   └── log_streamer.go             # ANSI log pipe to SSE
│   ├── proxy/                          # Dynamic reverse proxy
│   │   ├── manager.go                  # Route table and reverse proxy instances
│   │   └── director.go                 # Path rewriting and WebSocket handling
│   ├── network/                        # Wi-Fi provisioning & 60s rollback
│   │   ├── wifi_manager.go             # AP/Client orchestrator
│   │   ├── rollback.go                 # 60s watchdog timer
│   │   └── scanner.go                  # Wi-Fi network scanner
│   ├── hardware/                       # Framebuffer kiosk bridge
│   │   ├── framebuffer.go              # /dev/fb0 1080p BGRA direct writer
│   │   └── qr.go                       # Pairing & portal QR code generator
│   └── pal/                            # Platform Abstraction Layer (PAL)
│       ├── pal.go                      # Hardware/OS abstraction interfaces
│       ├── pal_linux.go                # Real Linux ARM64 hardware implementation
│       └── pal_mock.go                 # Mock implementation for Windows/dev & CI
├── pkg/
│   └── manifest/                       # Declarative manifest schemas
│       ├── types.go                    # Compose & x-forgehub data models
│       └── parser.go                   # Manifest parser
├── web/                                # React SPA Frontend
│   ├── dist/                           # Production compiled assets
│   ├── src/                            # React TypeScript source code
│   │   ├── components/                 # UI components
│   │   ├── stores/                     # Zustand stores
│   │   ├── services/                   # API & SSE clients
│   │   └── types/                      # Frontend TypeScript types
│   ├── index.html                      # Entrypoint with zero-FOUC script
│   ├── package.json                    # Frontend dependencies
│   ├── tailwind.config.ts              # Enterprise dark palette
│   └── vite.config.ts                  # Vite build configuration
├── test/
│   └── e2e/                            # Opaque-box E2E test suite
│       ├── harness/                    # Test runner and HTTP/SSE client
│       ├── tier1_features/             # Tier 1 tests (>= 5 per feature)
│       ├── tier2_boundaries/           # Tier 2 tests (boundaries, RAM guard, rollback)
│       ├── tier3_pairwise/             # Tier 3 tests (combinations, viewports)
│       └── tier4_workloads/            # Tier 4 tests (real-world workflows)
├── Makefile                            # Standard build, test, package targets
├── go.mod                              # Go dependencies
└── go.sum
```
