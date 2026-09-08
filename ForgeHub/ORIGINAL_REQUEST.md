# Original User Request

## Initial Request — 2026-09-05T07:54:29Z

# Teamwork Project Prompt — Final

Build **ForgeHub**, an enterprise-grade, ultra-lightweight, single-binary edge appliance management platform and module store for ForgeOS on the BTV Express E10 (Amlogic S905X2, 2GB RAM, 8GB eMMC). The platform fuses the intuitive visual App Store of CasaOS, the clean directory-based stack management and xterm logs of Dockge, and the smart reverse proxy of Cosmos-Server, integrated with MultiForge hardware controls (Wi-Fi AP/Client with 60s rollback, HDMI Framebuffer Kiosk bridge, and pre-flight RAM guard).

Working directory: C:\Users\Aluno\Documents\multi-forge\ForgeHub
Integrity mode: development

## Directives & Feasibility Guardrails
- **Pre-Action Feasibility Check:** Before executing any major architectural action, verify technical feasibility and resource impact on 2GB RAM / 8GB eMMC hardware.
- **Enterprise Standards & Code Solidity:** Every configuration, endpoint, and system service must adhere to strict enterprise Linux standards (systemd units, POSIX compliance, proper error propagation, zero silent failures).
- **Human-Centric, Non-Bloated UI (Anti-Generic AI Design):** Strictly avoid generic, flashy, or clunky "AI-generated" aesthetics (no excessive gradients, no gimmicky neon glows, no bloated component trees). The design must feel authentic, refined, high-contrast, and solid—inspired by Red Hat PatternFly and CasaOS minimalism.
- **Anti-Overengineering:** Avoid bloated dependencies; implement clean, idiomatic Go and React solutions. Code reuse/adaptation from CasaOS/Dockge/Cosmos is encouraged for frontend design patterns and manifest schemas, while keeping the backend lean and fast.
- **Dark Mode First:** Both ForgeHub and the integrated Wi-Fi provisioner must default to Dark Mode on initial load.
- **Mobile-First UX:** All screens must be responsive and touch-friendly for smartphones scanning the TV's QR Code.

## Requirements

### R1. Go Daemon Core & Real-Time Engine (Backend)
- Single static Go binary (`CGO_ENABLED=0 GOOS=linux GOARCH=arm64`) using Chi router, consuming ≤ 15 MB RAM in idle.
- Embedded React SPA frontend compiled and embedded via `//go:embed`.
- Real-time telemetry streaming via Server-Sent Events (SSE) using `shirou/gopsutil` for CPU, RAM, thermal sensors (`/sys/class/thermal/thermal_zone0/temp`), disk, and network I/O.
- Embedded key-value persistence via `go.etcd.io/bbolt` (or atomic JSON) for module state, config, and installation status with zero daemon overhead.

### R2. Hybrid Module Runner & Edge Store (CasaOS + Dockge)
- **Hybrid Execution Engine:** Support both Docker Compose stacks (for containerized store apps) AND native Systemd services/scripts (for ultra-lightweight embedded modules like Mina IA).
- **Declarative Store Manifests:** Support Compose-based metadata with custom extensions (`x-forgehub` / `x-casaos` schema) containing name, description, RAM/CPU requirements, ports, categories, and icons.
- **Directory-Based Stacks:** Clean filesystem layout under `/opt/multiforge/modules/<id>/compose.yaml`.
- **Live Terminal & Log Streaming:** Stream `docker compose` and service lifecycle logs in real time over SSE directly into a web terminal (`@xterm/xterm`) with ANSI colors.
- **Pre-Flight Memory Guard:** Block container pull/launch if free RAM < 300 MB, warning the user through the UI.

### R3. Smart Reverse Proxy & Portless Access (Cosmos-Server)
- Built-in dynamic reverse proxy (`net/http/httputil`) routing `/app/{id}` or friendly subpaths directly to container/module internal ports.
- Zero manual port memorization for end users on port 80/8080.
- Automatic route registration and deregistration on module start/stop.

### R4. Hardware & Connectivity Integration (MultiForge Layer)
- Full Wi-Fi provisioning (AP & Client) with WPA2-PSK and 802.1X EAP (eduroam), with automatic 60s contingency rollback to AP on connection failure.
- HDMI framebuffer kiosk bridge (`/dev/fb0`) displaying dynamic QR codes for pairing and direct access to ForgeHub.

### R5. Responsive UI/UX & Design System (Frontend)
- React 18/19 + TypeScript + Vite + Tailwind CSS + Radix UI / Shadcn + Lucide Icons + Zustand.
- Professional enterprise dark design system inspired by CasaOS and Dockge.
- Mobile viewports (360x740, 390x844, 412x915) tested and pixel-perfect.

## Acceptance Criteria

### Functional & Contract Verification
- [ ] Statically compiled binary boots and serves on port 8080 (or 80) consuming ≤ 15 MB RSS in idle.
- [ ] All API endpoints (`/api/status`, `/api/scan`, `/api/metrics`, `/api/modules`, `/api/store`, `/api/services`) respond with < 50ms latency.
- [ ] SSE endpoint streams real-time CPU/RAM/Thermal metrics continuously without memory leaks.
- [ ] Module lifecycle (install, start, stop, view logs via xterm) operates with live progress streaming.
- [ ] Hybrid runner launches both Docker Compose stacks and native Systemd units seamlessly.
- [ ] Pre-flight memory guard triggers warning when simulated/actual free RAM < 300 MB.
- [ ] Smart reverse proxy cleanly proxies `/app/{id}` without port collision.
- [ ] Dark mode is active by default across all views without flash of unstyled theme (FOUC).
- [ ] Web UI renders cleanly on mobile viewports (360x740 up to 412x915) and desktop (1280x800+).
- [ ] Automated test suite passes verifying API contracts, P0 security redaction, and error handling.
