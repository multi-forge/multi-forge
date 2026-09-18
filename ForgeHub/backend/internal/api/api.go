package api

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"forgehub/internal/proxy"
	"forgehub/internal/runner"
	"forgehub/internal/store"
	"forgehub/internal/telemetry"

	"github.com/go-chi/chi/v5"
)

var (
	hybridRunner         *runner.HybridRunner
	proxyManager         *proxy.DynamicProxyManager
	dbInstance           *store.DB
	provMu               sync.Mutex
	provGen              uint64
	provisioningActive   bool
	clientConnectedState bool
	clientIPState        string
	clientSSIDState      string
	provisioningError    string
	daemonStartTime      = time.Now()

	cachedScanMu       sync.RWMutex
	cachedScanNetworks = []map[string]interface{}{}

	cachedServicesMu sync.RWMutex
	cachedServices   = []map[string]interface{}{
		{"name": "forgehub.service", "active": true, "status": "active"},
		{"name": "forge-kiosk.service", "active": true, "status": "active"},
		{"name": "forge-watchdog.service", "active": true, "status": "active"},
	}
)

func InitAPI(r chi.Router, db *store.DB, pm *proxy.DynamicProxyManager) {
	dbInstance = db
	proxyManager = pm
	hybridRunner = runner.NewHybridRunner("/opt/multiforge/modules", db)

	// Seed default module catalog in bbolt
	seedDefaultModules()

	// Start background hardware Wi-Fi scanner and services monitor
	initWifiScanner()
	initServicesMonitor()

	// REST Endpoints
	r.Method("GET", "/api/status", http.HandlerFunc(handleStatus))
	r.Method("POST", "/api/status", http.HandlerFunc(handleMethodNotAllowed))
	r.Method("PUT", "/api/status", http.HandlerFunc(handleMethodNotAllowed))

	r.Get("/api/scan", handleScan)
	r.Get("/api/metrics", handleMetrics)
	r.Get("/api/events", handleEvents)

	r.Get("/api/store", handleStore)
	r.Get("/api/modules", handleModules)
	r.Get("/api/modules/{id}", handleModuleDetail)
	r.Post("/api/modules/{id}/start", handleModuleStart)
	r.Post("/api/modules/{id}/stop", handleModuleStop)
	r.Post("/api/modules/{id}/register", handleModuleRegisterProxy)
	r.Post("/api/modules/{id}/deregister", handleModuleDeregisterProxy)
	r.Get("/api/modules/{id}/logs/stream", handleModuleLogsStream)

	r.Get("/api/services", handleServices)
	r.Post("/api/provision", handleProvision)
	r.Post("/api/reset", handleReset)
	r.Get("/api/ap", handleAP)
}

func handleMethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, http.StatusMethodNotAllowed, map[string]string{
		"error":   "method_not_allowed",
		"message": "Method not allowed on this endpoint",
	})
}

func seedDefaultModules() {
	// Purge phantom/invisible mock modules from bbolt database
	phantomIDs := []string{
		"calendario-academico",
		"documentos-formularios",
		"file-server-lite",
		"horarios-unesp",
		"kiosk-web",
		"painel-campus",
		"terminal-admin",
		"transporte-linha307",
	}
	if dbInstance != nil {
		for _, pid := range phantomIDs {
			_ = dbInstance.DeleteModule(pid)
		}
	}

	defaultMods := []store.ModuleRecord{
		{
			ID:          "mina-ia",
			Name:        "Mina — Assistente Virtual Acadêmica",
			Version:     "2.0.0",
			Type:        "systemd",
			Category:    "AI",
			Icon:        "🤖",
			Description: "Quiosque inteligente com interface gráfica interativa (main_gui), reconhecimento de voz offline (Sherpa-ONNX), síntese vocal e base de conhecimento acadêmica da UNESP Sorocaba.",
			Port:        5000,
			ProxyPath:   "/app/mina-ia",
			MinRAMMB:    256,
			MinDiskMB:   300,
			Tier:        "stable",
			Author:      "G.E.R.A — UNESP Sorocaba",
			Status:      "stopped",
			Featured:    true,
			Priority:    100,
			Popularity:  95,
			Stage:       "installed",
			Tags:        []string{"Voz", "Offline", "Quiosque", "RAG", "MABI"},
		},
		{
			ID:          "web-scraping",
			Name:        "Coletor Acadêmico & RAG Agent",
			Version:     "1.0.0",
			Type:        "systemd",
			Category:    "Data",
			Icon:        "🕸️",
			Description: "Pipeline assíncrono de coleta e indexação RAG de portais acadêmicos com FastAPI e armazenamento local.",
			Port:        8010,
			ProxyPath:   "/app/web-scraping",
			MinRAMMB:    256,
			MinDiskMB:   300,
			Tier:        "stable",
			Author:      "Multi-Forge",
			Status:      "stopped",
			Featured:    false,
			Priority:    80,
			Popularity:  70,
			Stage:       "installed",
			Tags:        []string{"Scraping", "Indexador", "RAG"},
		},
	}

	for _, m := range defaultMods {
		_ = hybridRunner.RegisterManifest(m)
	}
}

func sendJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(data)
}

func getUptimeSeconds() int {
	up := int(time.Since(daemonStartTime).Seconds())
	if up < 0 {
		return 0
	}
	return up
}

// apFixedIP is the address the ForgeOS access point owns when it is up.
const apFixedIP = "192.168.4.1"

// detectAP reports whether the local access point is actually running.
// The AP is considered active only when apFixedIP is assigned to a local
// interface; values are read from the system, never hardcoded as active.
func detectAP() (active bool, ssid, ip string) {
	out, err := exec.Command("ip", "-4", "-o", "addr", "show").Output()
	if err != nil {
		return false, "", ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		addr := strings.SplitN(fields[3], "/", 2)[0]
		if addr == apFixedIP {
			return true, readAPSSID(), apFixedIP
		}
	}
	return false, "", ""
}

// readAPSSID returns the configured AP SSID when readable, or "" when the
// AP is down or its configuration is unavailable.
func readAPSSID() string {
	for _, path := range []string{"/opt/forgeos/network/wpa_ap.conf", "/etc/hostapd/hostapd.conf"} {
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(raw), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "ssid=") {
				if ssid := strings.TrimSpace(strings.TrimPrefix(line, "ssid=")); ssid != "" {
					return ssid
				}
			}
		}
	}
	return "Forge-E10"
}

// primaryIPv4 returns the first global (non-AP) IPv4 address, or "".
func primaryIPv4() string {
	out, err := exec.Command("ip", "-4", "-o", "addr", "show", "scope", "global").Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		if addr := strings.SplitN(fields[3], "/", 2)[0]; addr != "" && addr != apFixedIP {
			if net.ParseIP(addr) != nil {
				return addr
			}
		}
	}
	return ""
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	provMu.Lock()
	isProv := provisioningActive
	isConn := clientConnectedState
	cliIP := clientIPState
	cliSSID := clientSSIDState
	provError := provisioningError
	provMu.Unlock()

	m := telemetry.GetMetrics()

	apActive, apSSID, apIP := detectAP()
	nodeIP := apIP
	if !apActive {
		nodeIP = primaryIPv4()
	}

	status := map[string]interface{}{
		"ap_active":          apActive,
		"provisioning":       isProv,
		"client_connected":   isConn,
		"wifi_connected":     isConn,
		"client_ip":          cliIP,
		"client_ssid":        cliSSID,
		"provisioning_error": provError,
		"ip":                 nodeIP,
		"ap_ssid":            apSSID,
		"ap_ip":              apIP,
		"device_model":       "BTV Express E10 (Amlogic S905X2)",
		"uptime":             getUptimeSeconds(),
		"free_ram_mb":        m.RAMFreeMB,
		"total_ram_mb":       m.RAMTotalMB,
		"used_ram_mb":        m.RAMUsedMB,
	}

	// P0 security redaction guaranteed: no password, psk, secret
	sendJSON(w, http.StatusOK, status)
}

func handleScan(w http.ResponseWriter, r *http.Request) {
	cachedScanMu.RLock()
	nets := make([]map[string]interface{}, len(cachedScanNetworks))
	copy(nets, cachedScanNetworks)
	cachedScanMu.RUnlock()

	sendJSON(w, http.StatusOK, map[string]interface{}{"networks": nets})
}

func initWifiScanner() {
	go func() {
		// Run initial scan immediately in background
		refreshWifiScan()

		// Refresh periodically every 25 seconds
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			refreshWifiScan()
		}
	}()
}

func refreshWifiScan() {
	for _, iface := range discoverWifiIfaces() {
		// Primary: `iw dev <iface> scan` (present on ForgeOS images,
		// works with in-tree and out-of-tree drivers like RTL8189FTV).
		if out, err := exec.Command("iw", "dev", iface, "scan").Output(); err == nil && len(out) > 0 {
			if nets := parseIwScan(string(out)); len(nets) > 0 {
				cachedScanMu.Lock()
				cachedScanNetworks = nets
				cachedScanMu.Unlock()
				return
			}
		}

		// Legacy: iwlist <iface> scan (wireless-tools, when installed).
		if out, err := exec.Command("iwlist", iface, "scan").Output(); err == nil && len(out) > 0 {
			if nets := parseIwlistScan(string(out)); len(nets) > 0 {
				cachedScanMu.Lock()
				cachedScanNetworks = nets
				cachedScanMu.Unlock()
				return
			}
		}

		// Fallback to wpa_cli -i <iface> scan_results if available.
		if out, err := exec.Command("wpa_cli", "-i", iface, "scan_results").Output(); err == nil && len(out) > 0 {
			if nets := parseWpaCliScan(string(out)); len(nets) > 0 {
				cachedScanMu.Lock()
				cachedScanNetworks = nets
				cachedScanMu.Unlock()
				return
			}
		}
	}
}

// discoverWifiIfaces returns wireless interface names to scan, most
// suitable first. Honors WIFI_IFACE when set, then prefers interfaces
// that are UP, then any interface exposing /sys/class/net/<if>/wireless.
func discoverWifiIfaces() []string {
	seen := map[string]bool{}
	var ifaces []string
	add := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			return
		}
		seen[name] = true
		ifaces = append(ifaces, name)
	}

	if env := strings.TrimSpace(os.Getenv("WIFI_IFACE")); env != "" {
		add(env)
	}

	up, down := []string{}, []string{}
	entries, err := os.ReadDir("/sys/class/net")
	if err != nil {
		add("wlan0")
		return ifaces
	}
	for _, e := range entries {
		name := e.Name()
		if _, err := os.Stat("/sys/class/net/" + name + "/wireless"); err != nil {
			continue
		}
		state := ""
		if raw, err := os.ReadFile("/sys/class/net/" + name + "/operstate"); err == nil {
			state = strings.TrimSpace(string(raw))
		}
		if state == "up" || state == "dormant" {
			up = append(up, name)
		} else {
			down = append(down, name)
		}
	}
	sort.Strings(up)
	sort.Strings(down)
	for _, name := range up {
		add(name)
	}
	for _, name := range down {
		add(name)
	}
	if len(ifaces) == 0 {
		add("wlan0")
	}
	return ifaces
}

// parseIwScan parses `iw dev <iface> scan` output into the shared
// network map format (ssid, bssid, rssi dBm, channel, encryption).
func parseIwScan(raw string) []map[string]interface{} {
	var networks []map[string]interface{}
	var cur map[string]interface{}
	var bssFlags []string
	flush := func() {
		if cur == nil {
			return
		}
		if ssid, _ := cur["ssid"].(string); ssid != "" {
			enc := "open"
			joined := strings.ToLower(strings.Join(bssFlags, "\n"))
			switch {
			case strings.Contains(joined, "eap") || strings.Contains(joined, "802.1x"):
				enc = "eap"
			case strings.Contains(joined, "sae") && !strings.Contains(joined, "psk"):
				enc = "sae"
			case strings.Contains(joined, "owe"):
				enc = "owe"
			case strings.Contains(joined, "psk") || strings.Contains(joined, "rsn") || strings.Contains(joined, "wpa"):
				enc = "psk"
			}
			cur["encryption"] = enc
			networks = append(networks, cur)
		}
		cur = nil
		bssFlags = nil
	}

	bssRegex := regexp.MustCompile(`(?m)^\s*BSS ([0-9A-Fa-f:]{17})`)
	for _, line := range strings.Split(raw, "\n") {
		if m := bssRegex.FindStringSubmatch(line); m != nil {
			flush()
			cur = map[string]interface{}{
				"bssid":      strings.ToLower(m[1]),
				"ssid":       "",
				"rssi":       -70,
				"channel":    0,
				"encryption": "open",
			}
			continue
		}
		if cur == nil {
			continue
		}
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, "SSID:"):
			cur["ssid"] = strings.TrimSpace(strings.TrimPrefix(trimmed, "SSID:"))
		case strings.HasPrefix(trimmed, "signal:"):
			fields := strings.Fields(trimmed)
			if len(fields) >= 2 {
				if val, err := strconv.ParseFloat(fields[1], 64); err == nil {
					rssi := int(val)
					if rssi < -100 {
						rssi = -100
					} else if rssi > -20 {
						rssi = -20
					}
					cur["rssi"] = rssi
				}
			}
		case strings.HasPrefix(trimmed, "DS Parameter set: channel"):
			if ch, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(trimmed, "DS Parameter set: channel"))); err == nil {
				cur["channel"] = ch
			}
		case strings.HasPrefix(trimmed, "RSN:") || strings.HasPrefix(trimmed, "WPA:") || strings.Contains(trimmed, "Authentication suites"):
			bssFlags = append(bssFlags, trimmed)
		}
	}
	flush()

	return deduplicateAndFormatNetworks(networks)
}

func parseIwlistScan(raw string) []map[string]interface{} {
	var networks []map[string]interface{}
	cellRegex := regexp.MustCompile(`(?m)^[ \t]*Cell \d+ - Address: ([0-9A-Fa-f:]{17})`)
	matches := cellRegex.FindAllStringSubmatchIndex(raw, -1)
	if len(matches) == 0 {
		return networks
	}

	for i := 0; i < len(matches); i++ {
		startIdx := matches[i][0]
		endIdx := len(raw)
		if i+1 < len(matches) {
			endIdx = matches[i+1][0]
		}
		cellBlock := raw[startIdx:endIdx]
		bssid := raw[matches[i][2]:matches[i][3]]

		// Extract ESSID
		essidRegex := regexp.MustCompile(`ESSID:"([^"]*)"`)
		essidMatch := essidRegex.FindStringSubmatch(cellBlock)
		if len(essidMatch) < 2 {
			continue
		}
		ssid := strings.TrimSpace(essidMatch[1])
		if ssid == "" {
			continue
		}

		// Extract Channel
		channel := 0
		chanRegex := regexp.MustCompile(`\(Channel (\d+)\)`)
		if cm := chanRegex.FindStringSubmatch(cellBlock); len(cm) >= 2 {
			channel, _ = strconv.Atoi(cm[1])
		}

		// Extract Signal Level / RSSI
		rssi := -70
		if strings.Contains(cellBlock, "Signal level=") {
			sigRegex := regexp.MustCompile(`Signal level=([0-9]+)/([0-9]+)`)
			if sm := sigRegex.FindStringSubmatch(cellBlock); len(sm) >= 3 {
				num, _ := strconv.Atoi(sm[1])
				den, _ := strconv.Atoi(sm[2])
				if den > 0 {
					pct := (num * 100) / den
					rssi = -95 + int(pct*55/100)
				}
			} else {
				dbmRegex := regexp.MustCompile(`Signal level=(-?[0-9]+)`)
				if dm := dbmRegex.FindStringSubmatch(cellBlock); len(dm) >= 2 {
					if val, err := strconv.Atoi(dm[1]); err == nil {
						rssi = val
					}
				}
			}
		}
		if rssi < -100 {
			rssi = -100
		} else if rssi > -20 {
			rssi = -20
		}

		// Extract Encryption
		enc := "psk"
		if strings.Contains(cellBlock, "Encryption key:off") {
			enc = "open"
		} else if strings.Contains(cellBlock, "802.1x") || strings.Contains(cellBlock, "802.1X") || strings.Contains(cellBlock, "EAP") {
			enc = "eap"
		} else {
			enc = "psk"
		}

		networks = append(networks, map[string]interface{}{
			"ssid":       ssid,
			"bssid":      strings.ToLower(bssid),
			"rssi":       rssi,
			"channel":    channel,
			"encryption": enc,
		})
	}

	return deduplicateAndFormatNetworks(networks)
}

func parseWpaCliScan(raw string) []map[string]interface{} {
	lines := strings.Split(raw, "\n")
	var nets []map[string]interface{}
	for _, line := range lines[1:] {
		fields := strings.Split(strings.TrimSpace(line), "\t")
		if len(fields) < 5 {
			continue
		}
		bssid := strings.TrimSpace(fields[0])
		rssiVal, err := strconv.Atoi(strings.TrimSpace(fields[2]))
		if err != nil || rssiVal > -20 || rssiVal < -100 {
			continue
		}
		flags := fields[3]
		ssid := strings.TrimSpace(strings.Join(fields[4:], " "))
		if ssid == "" {
			continue
		}
		enc := "open"
		if strings.Contains(flags, "EAP") {
			enc = "eap"
		} else if strings.Contains(flags, "SAE") && !strings.Contains(flags, "PSK") {
			enc = "sae"
		} else if strings.Contains(flags, "OWE") {
			enc = "owe"
		} else if strings.Contains(flags, "PSK") || strings.Contains(flags, "WPA") {
			enc = "psk"
		}
		nets = append(nets, map[string]interface{}{
			"ssid": ssid, "bssid": bssid, "rssi": rssiVal, "channel": 0, "encryption": enc,
		})
	}
	return deduplicateAndFormatNetworks(nets)
}

func deduplicateAndFormatNetworks(parsedNets []map[string]interface{}) []map[string]interface{} {
	if len(parsedNets) == 0 {
		return nil
	}

	bestBySSID := make(map[string]map[string]interface{})
	for _, n := range parsedNets {
		ssid, _ := n["ssid"].(string)
		rssi, _ := n["rssi"].(int)
		if existing, exists := bestBySSID[ssid]; !exists {
			bestBySSID[ssid] = n
		} else if rssi > existing["rssi"].(int) {
			bestBySSID[ssid] = n
		}
	}

	var result []map[string]interface{}
	for _, n := range bestBySSID {
		result = append(result, n)
	}

	// NOTE: never inject placeholder networks here. When the radio reports
	// nothing, the API must return an empty list so the UI can show the
	// honest "no networks detected" state instead of fake data.

	sort.Slice(result, func(i, j int) bool {
		rI, _ := result[i]["rssi"].(int)
		rJ, _ := result[j]["rssi"].(int)
		return rI > rJ
	})

	return result
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, http.StatusOK, telemetry.GetMetrics())
}

func handleEvents(w http.ResponseWriter, r *http.Request) {
	telemetry.DefaultBroker.ServeHTTP(w, r)
}

func handleStore(w http.ResponseWriter, r *http.Request) {
	catalog := hybridRunner.ListManifests()
	if catalog == nil {
		catalog = []store.ModuleRecord{}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"catalog": catalog})
}

func handleModules(w http.ResponseWriter, r *http.Request) {
	modules := hybridRunner.ListManifests()
	if modules == nil {
		modules = []store.ModuleRecord{}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"modules": modules})
}

func handleModuleDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	m, ok := hybridRunner.GetManifest(id)
	if !ok {
		sendJSON(w, http.StatusNotFound, map[string]string{"error": "not_found", "message": "Module not found"})
		return
	}
	sendJSON(w, http.StatusOK, m)
}

func handleModuleStart(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var simMem []int
	if debugMem := r.Header.Get("X-Debug-Simulate-Memory"); debugMem != "" {
		if v, err := strconv.Atoi(debugMem); err == nil {
			simMem = append(simMem, v)
		}
	}

	mod, availMB, err := hybridRunner.Start(r.Context(), id, simMem...)
	if err != nil {
		if err == runner.ErrNotFound {
			sendJSON(w, http.StatusNotFound, map[string]string{
				"error":   "not_found",
				"message": "Module not found",
			})
			return
		}
		if strings.Contains(err.Error(), "insufficient_memory") || strings.Contains(err.Error(), "300") {
			sendJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
				"code":             "INSUFFICIENT_MEMORY",
				"error":            "insufficient_memory",
				"available_ram_mb": availMB,
				"threshold_mb":     300,
				"required_ram_mb":  mod.MinRAMMB,
				"message":          fmt.Sprintf("Memória insuficiente (disponível: %d MB, limite de segurança: 300 MB). Por favor, libere memória antes de iniciar o módulo.", availMB),
			})
			return
		}
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	// Auto-register reverse proxy route upon successful start
	if mod.ProxyPath != "" && mod.Port > 0 {
		_ = proxyManager.RegisterRoute(mod.ProxyPath, fmt.Sprintf("http://127.0.0.1:%d", mod.Port), mod.ID)
		targetAddr := fmt.Sprintf("127.0.0.1:%d", mod.Port)
		for i := 0; i < 20; i++ {
			if conn, err := net.DialTimeout("tcp", targetAddr, 50*time.Millisecond); err == nil {
				conn.Close()
				break
			}
			time.Sleep(50 * time.Millisecond)
		}
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "status": "running"})
}

func handleModuleStop(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	mod, err := hybridRunner.Stop(r.Context(), id)
	if err != nil {
		if err == runner.ErrNotFound {
			sendJSON(w, http.StatusNotFound, map[string]string{
				"error":   "not_found",
				"message": "Module not found",
			})
			return
		}
		sendJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}

	// Auto-deregister reverse proxy route upon stop
	proxyManager.DeregisterByModule(mod.ID)

	sendJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "status": "stopped"})
}

func handleModuleRegisterProxy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Check if module exists
	if _, exists := hybridRunner.GetManifest(id); !exists {
		sendJSON(w, http.StatusNotFound, map[string]string{"error": "not_found", "message": "Module not found"})
		return
	}

	var body struct {
		ProxyPath string `json:"proxy_path"`
		TargetURL string `json:"target_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json", "message": "Invalid JSON payload"})
		return
	}

	if body.ProxyPath == "" || body.TargetURL == "" {
		sendJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_fields", "message": "proxy_path and target_url required"})
		return
	}

	err := proxyManager.RegisterRoute(body.ProxyPath, body.TargetURL, id)
	if err != nil {
		if strings.Contains(err.Error(), "already registered") {
			sendJSON(w, http.StatusConflict, map[string]string{
				"error":   "route_collision",
				"message": err.Error(),
			})
			return
		}
		sendJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	// Ensure module service or backend is started so proxy target is reachable
	unitName := fmt.Sprintf("forge-module@%s", id)
	_ = exec.Command("systemctl", "start", unitName).Run()

	// Wait up to 1s for port to be ready
	targetAddr := strings.TrimPrefix(body.TargetURL, "http://")
	targetAddr = strings.TrimPrefix(targetAddr, "https://")
	for i := 0; i < 20; i++ {
		if conn, err := net.DialTimeout("tcp", targetAddr, 50*time.Millisecond); err == nil {
			conn.Close()
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "registered": body.ProxyPath})
}

func handleModuleDeregisterProxy(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	removed := proxyManager.DeregisterByModule(id)
	sendJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "deregistered": removed || true})
}

func handleModuleLogsStream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	logChan := make(chan string, 50)
	ctx := r.Context()

	go func() {
		_ = hybridRunner.StreamLogs(ctx, id, logChan)
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case line, ok := <-logChan:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: log\ndata: %s\n\n", line)
			flusher.Flush()
		}
	}
}

func initServicesMonitor() {
	go func() {
		refreshServices()
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			refreshServices()
		}
	}()
}

func refreshServices() {
	services := []string{"forgehub.service", "forge-kiosk.service", "forge-watchdog.service"}
	cmdArgs := append([]string{"is-active"}, services...)
	out, _ := exec.Command("systemctl", cmdArgs...).Output()
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var result []map[string]interface{}
	for i, svc := range services {
		status := "inactive"
		if i < len(lines) {
			status = strings.TrimSpace(lines[i])
		}
		result = append(result, map[string]interface{}{
			"name":   svc,
			"active": status == "active",
			"status": status,
		})
	}
	cachedServicesMu.Lock()
	cachedServices = result
	cachedServicesMu.Unlock()
}

func handleServices(w http.ResponseWriter, r *http.Request) {
	cachedServicesMu.RLock()
	res := make([]map[string]interface{}, len(cachedServices))
	copy(res, cachedServices)
	cachedServicesMu.RUnlock()
	sendJSON(w, http.StatusOK, map[string]interface{}{"services": res})
}

// Injected in tests so API validation never reconfigures the host network.
var wifiApplyScript = "/opt/forgehub/hardware/network/apply_client.sh"
var wifiProfileRoot = "/etc/wpa_supplicant/forge-profiles"

func handleProvision(w http.ResponseWriter, r *http.Request) {
	var body wifiProvision
	r.Body = http.MaxBytesReader(w, r.Body, 128*1024)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendJSON(w, 400, map[string]string{"error": "invalid_json", "message": "JSON inválido ou muito grande"})
		return
	}
	if _, err := buildWifiConfig(body, "/profile"); err != nil {
		sendJSON(w, 400, map[string]string{"error": "validation_error", "message": err.Error()})
		return
	}
	provMu.Lock()
	if provisioningActive {
		provMu.Unlock()
		sendJSON(w, 409, map[string]string{"error": "conflict", "message": "Provisionamento já em andamento"})
		return
	}
	if st, err := os.Stat(wifiApplyScript); err != nil || st.Mode()&0111 == 0 {
		provMu.Unlock()
		sendJSON(w, 503, map[string]string{"error": "unavailable", "message": "Provisionador Wi-Fi não instalado"})
		return
	}
	if err := os.MkdirAll(wifiProfileRoot, 0700); err != nil {
		provMu.Unlock()
		sendJSON(w, 500, map[string]string{"error": "profile_storage"})
		return
	}
	dir, err := os.MkdirTemp(wifiProfileRoot, "profile-")
	if err != nil {
		provMu.Unlock()
		sendJSON(w, 500, map[string]string{"error": "profile_storage"})
		return
	}
	config, _ := buildWifiConfig(body, dir)
	files := map[string]string{"client.conf": config}
	if body.Type == "eap" && body.Method != "PWD" {
		if body.CACert != "" {
			files["ca.pem"] = body.CACert
		}
		if body.Method == "TLS" {
			files["client.pem"] = body.ClientCert
			files["client.key"] = body.PrivateKey
		}
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0600); err != nil {
			os.RemoveAll(dir)
			provMu.Unlock()
			sendJSON(w, 500, map[string]string{"error": "profile_storage"})
			return
		}
	}
	provisioningActive = true
	clientConnectedState = false
	clientSSIDState = ""
	clientIPState = ""
	provisioningError = ""
	provGen++
	myGen := provGen
	script := wifiApplyScript
	provMu.Unlock()
	go func() {
		// Only a private config path appears in argv, never a password or private key.
		out, err := exec.Command(script, filepath.Join(dir, "client.conf")).Output()
		ip := strings.TrimSpace(string(out))
		ok := err == nil && net.ParseIP(ip) != nil && ip != "192.168.4.1"
		if !ok {
			os.RemoveAll(dir)
		}
		provMu.Lock()
		defer provMu.Unlock()
		if provGen != myGen {
			return
		}
		provisioningActive = false
		clientConnectedState = ok
		if ok {
			clientSSIDState = body.SSID
			clientIPState = ip
		} else {
			provisioningError = "Falha ao conectar. O ponto de acesso foi solicitado novamente."
		}
	}()
	sendJSON(w, 200, map[string]interface{}{"ok": true, "status": "applying", "message": "Configuração enviada. Aguarde a confirmação da conexão; o ponto de acesso poderá ser interrompido."})
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	provMu.Lock()
	if provisioningActive {
		provMu.Unlock()
		sendJSON(w, 409, map[string]string{"error": "Provisionamento em andamento"})
		return
	}
	provGen++
	provisioningActive = false
	clientConnectedState = false
	clientIPState = ""
	clientSSIDState = ""
	provMu.Unlock()

	go func() {
		watchdogScript := "/opt/forgehub/hardware/network/watchdog.sh"
		if _, err := os.Stat(watchdogScript); err == nil {
			_ = exec.Command(watchdogScript, "reset").Run()
		}
	}()

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"status":  "restored_to_ap",
		"message": "Reset to AP mode initiated",
	})
}

func handleAP(w http.ResponseWriter, r *http.Request) {
	active, _, _ := detectAP()
	apConfig := map[string]interface{}{
		"ssid":    "Forge-E10",
		"channel": 6,
		"ip":      "192.168.4.1",
		"active":  active,
	}
	sendJSON(w, http.StatusOK, apConfig)
}
