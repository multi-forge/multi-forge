# Dead Ends Log

| Iteration | Approach Tried | Why It Failed | Files Touched |
|-----------|---------------|---------------|---------------|
| Audit R1 | Facade bbolt store without CRUD methods | Violates integrity: modules stored in memory map, nothing persisted to bbolt | `backend/internal/store/store.go` |
| Audit R1 | Hardcoded API responses for `/api/scan`, `/api/services`, `/api/status` | Violates integrity: does not query real hardware interfaces (`iw`, `wpa_cli`, `systemctl`) | `backend/internal/api/api.go` |
| Audit R1 | Frontend simulation using `Math.random()`, fake `setInterval`, and browser `alert()` | Violates integrity: frontend completely disconnected from backend APIs | `frontend/src/*` |
| Audit R1 | Self-certifying mock server (`test_server.mjs`) with synthetic assertions (`proxied: true`) | Violates integrity: tests assert internal mock properties instead of real appliance behavior; fails against real daemon | `test/e2e/*` |
| Audit R1 | Stub `/api/provision` returning static JSON without executing scripts or 60s rollback watchdog | Violates R4 requirement: does not configure Wi-Fi or arm contingency rollback | `backend/internal/api/api.go` |
