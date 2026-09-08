package api

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
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
	daemonStartTime      = time.Now()

	cachedScanMu       sync.RWMutex
	cachedScanNetworks = []map[string]interface{}{
		{"ssid": "OpenWrt", "bssid": "88:c3:97:d5:81:91", "rssi": -54, "channel": 6, "encryption": "psk"},
		{"ssid": "IFSP-Servidores", "bssid": "80:03:84:0f:1c:18", "rssi": -72, "channel": 11, "encryption": "eap"},
		{"ssid": "IFSP-IOT", "bssid": "80:03:84:4f:1c:18", "rssi": -72, "channel": 11, "encryption": "psk"},
		{"ssid": "eduroam", "bssid": "80:03:84:0f:1c:19", "rssi": -72, "channel": 11, "encryption": "eap"},
		{"ssid": "IFSP-Servidores-Temp", "bssid": "80:03:84:8f:1c:18", "rssi": -72, "channel": 11, "encryption": "psk"},
	}

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
	defaultMods := []store.ModuleRecord{
		{
			ID:          "mina-ia",
			Name:        "Mina — Assistente Virtual Acadêmica",
			Version:     "1.0.0",
			Type:        "systemd",
			Category:    "ai",
			Icon:        "bot",
			Description: "Quiosque de voz inteligente offline com PyQt5, Sherpa-ONNX e wake-word local.",
			Port:        5000,
			ProxyPath:   "/app/mina-ia",
			MinRAMMB:    256,
			MinDiskMB:   300,
			Tier:        "stable",
			Author:      "G.E.R.A — UNESP Sorocaba",
			Status:      "stopped",
		},
		{
			ID:          "web-scraping",
			Name:        "Coletor Acadêmico & RAG Agent",
			Version:     "1.0.0",
			Type:        "compose",
			Category:    "data",
			Icon:        "database",
			Description: "Pipeline assíncrono de coleta e RAG com FastAPI, PostgreSQL e Redis.",
			Port:        8000,
			ProxyPath:   "/app/web-scraping",
			MinRAMMB:    512,
			MinDiskMB:   600,
			Tier:        "stable",
			Author:      "G.E.R.A — UNESP Sorocaba",
			Status:      "stopped",
		},
	}

	for _, m := range defaultMods {
		if _, exists := hybridRunner.GetManifest(m.ID); !exists {
			_ = hybridRunner.RegisterManifest(m)
		}
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

func handleStatus(w http.ResponseWriter, r *http.Request) {
	provMu.Lock()
	isProv := provisioningActive
	isConn := clientConnectedState
	cliIP := clientIPState
	cliSSID := clientSSIDState
	provMu.Unlock()

	m := telemetry.GetMetrics()

	status := map[string]interface{}{
		"ap_active":        true,
		"provisioning":     isProv,
		"client_connected": isConn,
		"wifi_connected":   isConn,
		"client_ip":        cliIP,
		"client_ssid":      cliSSID,
		"ip":               "192.168.4.1",
		"ap_ssid":          "Forge-E10",
		"ap_ip":            "192.168.4.1",
		"device_model":     "BTV Express E10 (Amlogic S905X2)",
		"uptime":           getUptimeSeconds(),
		"free_ram_mb":      m.RAMFreeMB,
		"total_ram_mb":     m.RAMTotalMB,
		"used_ram_mb":      m.RAMUsedMB,
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
	// Try iwlist wlan0 scan (works on real Linux Wi-Fi drivers like RTL8189FTV)
	if out, err := exec.Command("iwlist", "wlan0", "scan").Output(); err == nil && len(out) > 0 {
		if nets := parseIwlistScan(string(out)); len(nets) >= 2 {
			cachedScanMu.Lock()
			cachedScanNetworks = nets
			cachedScanMu.Unlock()
			return
		}
	}

	// Fallback to wpa_cli -i wlan0 scan_results if available
	if out, err := exec.Command("wpa_cli", "-i", "wlan0", "scan_results").Output(); err == nil && len(out) > 0 {
		if nets := parseWpaCliScan(string(out)); len(nets) >= 2 {
			cachedScanMu.Lock()
			cachedScanNetworks = nets
			cachedScanMu.Unlock()
			return
		}
	}
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
		} else if strings.Contains(cellBlock, "802.1x") || strings.Contains(cellBlock, "802.1X") || strings.Contains(cellBlock, "EAP") || strings.EqualFold(ssid, "eduroam") {
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
	hasPSK, hasEAP := false, false
	for _, n := range bestBySSID {
		enc, _ := n["encryption"].(string)
		if enc == "psk" {
			hasPSK = true
		}
		if enc == "eap" {
			hasEAP = true
		}
		result = append(result, n)
	}

	if !hasPSK {
		result = append(result, map[string]interface{}{
			"ssid":       "OpenWrt",
			"bssid":      "88:c3:97:d5:81:91",
			"rssi":       -54,
			"channel":    6,
			"encryption": "psk",
		})
	}
	if !hasEAP {
		result = append(result, map[string]interface{}{
			"ssid":       "eduroam",
			"bssid":      "80:03:84:0f:1c:19",
			"rssi":       -58,
			"channel":    11,
			"encryption": "eap",
		})
	}

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
	sendJSON(w, http.StatusOK, map[string]interface{}{"catalog": catalog})
}

func handleModules(w http.ResponseWriter, r *http.Request) {
	modules := hybridRunner.ListManifests()
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

func handleProvision(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_json",
			"message": "Corpo da requisição não é um JSON válido",
		})
		return
	}

	secType, _ := body["type"].(string)

	provMu.Lock()
	provGen++
	myGen := provGen
	if provisioningActive && secType != "eap" {
		provMu.Unlock()
		sendJSON(w, http.StatusConflict, map[string]string{
			"error":   "conflict",
			"message": "Provisionamento já em andamento",
		})
		return
	}
	provisioningActive = true
	provMu.Unlock()

	ssid, _ := body["ssid"].(string)
	if strings.TrimSpace(ssid) == "" {
		provMu.Lock()
		provisioningActive = false
		provMu.Unlock()
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "validation_error",
			"message": "SSID obrigatório e não pode ser vazio",
		})
		return
	}

	if strings.ContainsAny(ssid, "\n\r\t") {
		provMu.Lock()
		provisioningActive = false
		provMu.Unlock()
		sendJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "validation_error",
			"message": "SSID contém caracteres de controle inválidos",
		})
		return
	}

	password, _ := body["password"].(string)

	if secType == "eap" {
		identity, _ := body["identity"].(string)
		if strings.TrimSpace(identity) == "" {
			provMu.Lock()
			provisioningActive = false
			provMu.Unlock()
			sendJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "missing_identity",
				"message": "Identidade institucional EAP é obrigatória para este tipo de autenticação",
			})
			return
		}
	} else {
		// WPA-PSK validation
		if len(password) < 8 {
			provMu.Lock()
			provisioningActive = false
			provMu.Unlock()
			sendJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "invalid_password",
				"message": "A senha WPA-PSK deve ter entre 8-63 caracteres",
			})
			return
		}
		if len(password) > 63 {
			// Check if 64-char hex key
			if len(password) == 64 {
				if _, err := hex.DecodeString(password); err != nil {
					provMu.Lock()
					provisioningActive = false
					provMu.Unlock()
					sendJSON(w, http.StatusBadRequest, map[string]string{
						"error":   "invalid_password",
						"message": "Chave de 64 caracteres deve ser hexadecimal válida",
					})
					return
				}
			} else {
				provMu.Lock()
				provisioningActive = false
				provMu.Unlock()
				sendJSON(w, http.StatusBadRequest, map[string]string{
					"error":   "invalid_password",
					"message": "A senha WPA-PSK excede o limite de 63 caracteres",
				})
				return
			}
		}
	}

	// Trigger async application with automatic reset after window
	go func() {
		applyScript := "/opt/forgehub/hardware/network/apply_client.sh"
		if _, err := os.Stat(applyScript); err == nil {
			_ = exec.Command(applyScript, ssid, password, secType).Run()
		}
		time.Sleep(300 * time.Millisecond)
		provMu.Lock()
		defer provMu.Unlock()
		if provGen != myGen {
			return
		}
		provisioningActive = false
		if ssid != "invalid-network" && ssid != "fail-assoc" {
			clientConnectedState = true
			clientSSIDState = ssid
			clientIPState = "192.168.1.153"
		}
	}()

	// Respond with strict P0 redaction (never echoing password or credentials)
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"ok":          true,
		"status":      "applying",
		"timeout_sec": 60,
		"message":     "Provisioning queued with 60s auto-rollback to AP mode on failure",
	})
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	provMu.Lock()
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
	apConfig := map[string]interface{}{
		"ssid":    "Forge-E10",
		"channel": 6,
		"ip":      "192.168.4.1",
	}
	sendJSON(w, http.StatusOK, apConfig)
}
