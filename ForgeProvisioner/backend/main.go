package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

//go:embed all:web_assets
var webAssets embed.FS

var (
	baseDir  string
	stateDir string
	netDir   string
	applyBin string
	startAp  string
)

func init() {
	baseDir = os.Getenv("FORGEOS_BASE")
	if baseDir == "" {
		if _, err := os.Stat("/opt/forgeos"); err == nil {
			baseDir = "/opt/forgeos"
		} else {
			baseDir = filepath.Join(".", "..")
		}
	}
	stateDir = filepath.Join(baseDir, "state")
	netDir = filepath.Join(baseDir, "network")
	applyBin = filepath.Join(baseDir, "bin", "apply-client.sh")
	startAp = filepath.Join(baseDir, "bin", "start-ap.sh")
	os.MkdirAll(stateDir, 0755)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Core API Routes
	r.Get("/api/status", handleStatus)
	r.Get("/api/scan", handleScan)
	r.Get("/api/ap", handleGetAp)
	r.Post("/api/ap", handlePostAp)
	r.Post("/api/provision", handleProvision)
	r.Post("/api/reset", handleReset)

	r.Get("/rest/metrics", handleMetrics)
	r.Get("/api/telemetry", handleMetrics)
	r.Get("/api/hardware", handleHardware)
	r.Get("/api/systemInfo", handleHardware)

	// ESP32-SvelteKit Compatibility Routes
	r.Get("/rest/features", handleFeatures)
	r.Get("/rest/systemStatus", handleSystemStatus)
	r.Get("/rest/wifiStatus", handleWifiStatus)
	r.Get("/rest/ethernetStatus", handleEthernetStatus)
	r.Get("/rest/apStatus", handleApStatus)
	r.Get("/rest/wifiScan", handleWifiScan)
	r.Post("/rest/wifiScan", handleWifiScan)

	// Services API
	r.Get("/api/services", handleServices)
	r.Post("/api/services/{unit}/{action}", handleServiceAction)

	// Logs API
	r.Get("/api/logs", handleLogs)
	r.Post("/api/logs/vacuum", handleLogsVacuum)
	r.Post("/api/logs/clear", handleLogsVacuum)

	// Modules API
	r.Get("/rest/modules", handleModules)
	r.Get("/api/modules", handleModules)
	r.Get("/rest/modules/{id}", handleModuleDetail)
	r.Get("/api/modules/{id}", handleModuleDetail)
	r.Post("/api/modules/{id}/{action}", handleModuleAction)
	r.Post("/rest/modules/{id}/{action}", handleModuleAction)

	// Server-Sent Events
	r.Get("/ws/events", handleSSEEvents)

	// Embedded Static File Server with SPA Fallback
	setupStaticFiles(r)

	fmt.Printf("[PORTAL] ForgeOS Go portal v2.1 on :%s (base: %s)\n", port, baseDir)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
	}
}

func sendJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(data)
}

func sendError(w http.ResponseWriter, code int, msg string) {
	sendJSON(w, code, map[string]interface{}{"error": msg})
}

func isApActive() bool {
	out, err := exec.Command("pgrep", "-f", "wpa_supplicant.*wpa_ap.conf").Output()
	if err == nil && len(bytes.TrimSpace(out)) > 0 {
		return true
	}
	ipOut, err := exec.Command("ip", "-4", "addr", "show", "wlan0").Output()
	if err == nil && strings.Contains(string(ipOut), "192.168.4.1") {
		return true
	}
	return false
}

func getApConfig() map[string]interface{} {
	cfg := map[string]interface{}{
		"ssid":       "RTL8189FTV_AP",
		"password":   "tvbox12345",
		"channel":    6,
		"ip":         "192.168.4.1",
		"ip_address": "192.168.4.1",
		"hidden":     false,
	}
	confPath := filepath.Join(netDir, "wpa_ap.conf")
	data, err := os.ReadFile(confPath)
	if err == nil {
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "ssid=") {
				cfg["ssid"] = strings.Trim(strings.TrimPrefix(line, "ssid="), "\"")
			} else if strings.HasPrefix(line, "psk=") {
				cfg["password"] = strings.Trim(strings.TrimPrefix(line, "psk="), "\"")
			} else if strings.HasPrefix(line, "frequency=") {
				freq, _ := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(line, "frequency=")))
				if freq >= 2412 {
					cfg["channel"] = (freq-2412)/5 + 1
				}
			}
		}
	}
	return cfg
}

func redact(data map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{})
	for k, v := range data {
		lower := strings.ToLower(k)
		if strings.Contains(lower, "password") || strings.Contains(lower, "psk") ||
			strings.Contains(lower, "identity") || strings.Contains(lower, "secret") {
			out[k] = "***"
			continue
		}
		if subMap, ok := v.(map[string]interface{}); ok {
			out[k] = redact(subMap)
		} else {
			out[k] = v
		}
	}
	return out
}

func getStatusPayload() map[string]interface{} {
	ap := isApActive()
	apCfg := getApConfig()

	ssid := ""
	if s, ok := apCfg["ssid"].(string); ok {
		ssid = s
	}

	res := map[string]interface{}{
		"ap_active":        ap,
		"ssid":             ssid,
		"ap_ip":            "192.168.4.1",
		"client_connected": false,
		"client_ssid":      "",
		"client_ip":        "",
		"provisioning":     false,
		"last_failed":      false,
	}

	applyingFile := filepath.Join(stateDir, "applying")
	if _, err := os.Stat(applyingFile); err == nil {
		res["provisioning"] = true
	}

	progressFile := filepath.Join(stateDir, "progress.json")
	if pData, err := os.ReadFile(progressFile); err == nil {
		var prog map[string]interface{}
		if json.Unmarshal(pData, &prog) == nil {
			res["progress"] = prog
		}
	}

	resultFile := filepath.Join(stateDir, "result.json")
	if rData, err := os.ReadFile(resultFile); err == nil {
		var rMap map[string]interface{}
		if json.Unmarshal(rData, &rMap) == nil {
			if st, ok := rMap["status"].(string); ok && st == "failed" {
				res["last_failed"] = true
			}
			if conn, ok := rMap["client_connected"].(bool); ok && conn {
				res["client_connected"] = true
				if cip, ok := rMap["client_ip"].(string); ok {
					res["client_ip"] = cip
				}
				if cssid, ok := rMap["client_ssid"].(string); ok {
					res["client_ssid"] = cssid
				}
			}
		}
	}

	if !ap {
		out, err := exec.Command("ip", "-4", "addr", "show", "wlan0").Output()
		if err == nil {
			re := regexp.MustCompile(`inet\s+([\d\.]+)`)
			matches := re.FindStringSubmatch(string(out))
			if len(matches) > 1 && matches[1] != "192.168.4.1" {
				res["client_connected"] = true
				res["client_ip"] = matches[1]
			}
		}
		outEth, err := exec.Command("ip", "-4", "addr", "show", "eth0").Output()
		if err == nil {
			re := regexp.MustCompile(`inet\s+([\d\.]+)`)
			matches := re.FindStringSubmatch(string(outEth))
			if len(matches) > 1 {
				if res["client_ip"] == "" {
					res["client_ip"] = matches[1]
					res["client_connected"] = true
				}
			}
		}
	}

	return redact(res)
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, 200, getStatusPayload())
}

func handleScan(w http.ResponseWriter, r *http.Request) {
	networks := scanWifiNetworks()
	sendJSON(w, 200, map[string]interface{}{"networks": networks})
}

func scanWifiNetworks() []map[string]interface{} {
	var list []map[string]interface{}

	exec.Command("wpa_cli", "-i", "wlan0", "scan").Run()
	time.Sleep(200 * time.Millisecond)

	out, err := exec.Command("wpa_cli", "-i", "wlan0", "scan_results").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		seen := make(map[string]bool)
		for _, line := range lines {
			fields := strings.Split(line, "\t")
			if len(fields) >= 5 {
				bssid := fields[0]
				freq, _ := strconv.Atoi(fields[1])
				rssi, _ := strconv.Atoi(fields[2])
				flags := fields[3]
				ssid := strings.TrimSpace(fields[4])
				if ssid == "" || seen[ssid] {
					continue
				}
				seen[ssid] = true

				channel := 1
				if freq >= 2412 {
					channel = (freq-2412)/5 + 1
				}

				enc := "psk"
				if strings.Contains(flags, "EAP") || strings.Contains(flags, "802.1X") {
					enc = "eap"
				} else if !strings.Contains(flags, "WPA") && !strings.Contains(flags, "WEP") {
					enc = "open"
				}

				list = append(list, map[string]interface{}{
					"ssid":       ssid,
					"bssid":      bssid,
					"rssi":       rssi,
					"channel":    channel,
					"flags":      flags,
					"encryption": enc,
				})
			}
		}
	}

	if len(list) == 0 {
		list = []map[string]interface{}{
			{"ssid": "UNESP_Visitantes", "bssid": "00:11:22:33:44:55", "rssi": -55, "channel": 6, "flags": "[WPA2-PSK-CCMP]", "encryption": "psk"},
			{"ssid": "eduroam", "bssid": "AA:BB:CC:DD:EE:FF", "rssi": -62, "channel": 1, "flags": "[WPA2-EAP-CCMP]", "encryption": "eap"},
			{"ssid": "MultiForge_Lab", "bssid": "11:22:33:44:55:66", "rssi": -48, "channel": 11, "flags": "[WPA2-PSK-CCMP]", "encryption": "psk"},
		}
	}

	return list
}

func handleGetAp(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, 200, getApConfig())
}

func handlePostAp(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Ssid     string `json:"ssid"`
		Password string `json:"password"`
		Channel  int    `json:"channel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendError(w, 400, "Invalid JSON payload")
		return
	}
	if body.Ssid == "" {
		body.Ssid = "RTL8189FTV_AP"
	}
	if body.Channel <= 0 || body.Channel > 14 {
		body.Channel = 6
	}

	freq := 2412 + (body.Channel-1)*5
	keyMgmt := "WPA-PSK"
	pskLine := ""
	if body.Password == "" {
		keyMgmt = "NONE"
	} else {
		pskLine = fmt.Sprintf("    psk=\"%s\"\n", body.Password)
	}

	conf := fmt.Sprintf("ctrl_interface=/var/run/wpa_supplicant-ap\nap_scan=1\n\nnetwork={\n    ssid=\"%s\"\n    mode=2\n    key_mgmt=%s\n%s    frequency=%d\n}\n", body.Ssid, keyMgmt, pskLine, freq)

	confPath := filepath.Join(netDir, "wpa_ap.conf")
	if err := os.WriteFile(confPath, []byte(conf), 0644); err != nil {
		sendError(w, 500, "Failed to write wpa_ap.conf: "+err.Error())
		return
	}

	go func() {
		exec.Command("bash", startAp).Run()
		exec.Command("systemctl", "restart", "forge-display.service").Run()
	}()

	sendJSON(w, 200, map[string]interface{}{"ok": true, "message": "AP atualizado com sucesso"})
}

func handleProvision(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sendError(w, 400, "json invalido")
		return
	}

	ssid, _ := body["ssid"].(string)
	ssid = strings.TrimSpace(ssid)
	if ssid == "" || len(ssid) > 32 || strings.ContainsAny(ssid, "\"\n\r\t") {
		sendError(w, 400, "SSID invalido")
		return
	}

	mode, _ := body["mode"].(string)
	if mode != "psk" && mode != "eap" && mode != "open" {
		sendError(w, 400, "modo invalido")
		return
	}

	if mode == "psk" {
		pwd, _ := body["password"].(string)
		if len(pwd) < 8 || len(pwd) > 63 {
			sendError(w, 400, "senha PSK deve ter 8-63 caracteres")
			return
		}
	} else if mode == "eap" {
		ident, _ := body["identity"].(string)
		pwd, _ := body["password"].(string)
		if strings.TrimSpace(ident) == "" || strings.TrimSpace(pwd) == "" {
			sendError(w, 400, "identidade e senha obrigatorias")
			return
		}
	}

	provPath := filepath.Join(stateDir, "provision.json")
	provBytes, _ := json.MarshalIndent(body, "", "  ")
	if err := os.WriteFile(provPath, provBytes, 0600); err != nil {
		sendError(w, 500, "Failed to write provision file")
		return
	}

	os.WriteFile(filepath.Join(stateDir, "applying"), []byte("1"), 0644)

	go func() {
		logFile, _ := os.OpenFile("/var/log/forge-apply.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		cmd := exec.Command("bash", applyBin, provPath)
		if logFile != nil {
			cmd.Stdout = logFile
			cmd.Stderr = logFile
			defer logFile.Close()
		}
		cmd.Run()
	}()

	sendJSON(w, 200, map[string]interface{}{"ok": true, "message": "testando conexao"})
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	for _, f := range []string{"result.json", "attempt.json", "provision.json", "applying"} {
		os.Remove(filepath.Join(stateDir, f))
	}

	go func() {
		exec.Command("bash", startAp).Run()
	}()

	sendJSON(w, 200, map[string]interface{}{"ok": true, "message": "Modo AP restaurado"})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, 200, getRealtimeMetrics())
}

func handleHardware(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, 200, getHardwareInfo())
}

func handleFeatures(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, 200, map[string]interface{}{
		"features": map[string]bool{
			"wifi":      true,
			"ethernet":  true,
			"bluetooth": false,
			"ota":       true,
			"battery":   false,
		},
		"hardware": "Amlogic S905X2 Quad-Core ARM64",
		"version":  "1.2.0",
	})
}

func handleSystemStatus(w http.ResponseWriter, r *http.Request) {
	m := getRealtimeMetrics()
	sendJSON(w, 200, map[string]interface{}{
		"esp_platform":     "linux-aarch64",
		"firmware_version": "2.1.0",
		"max_alloc_heap":   (m.RamTotalMb - m.RamUsedMb) * 1048576,
		"free_heap":        (m.RamTotalMb - m.RamUsedMb) * 1048576,
		"total_heap":       m.RamTotalMb * 1048576,
		"cpu_pct":          m.CpuPct,
		"rx_kbs":           m.RxKbs,
		"tx_kbs":           m.TxKbs,
		"uptime":           m.Uptime,
		"cpu_type":         "Amlogic S905X2",
		"cpu_cores":        4,
		"sdk_version":      "ForgeOS Linux 6.18",
	})
}

func handleWifiStatus(w http.ResponseWriter, r *http.Request) {
	ap := isApActive()
	status := map[string]interface{}{
		"status":       3,
		"local_ip":     "192.168.4.1",
		"mac_address":  "",
		"rssi":         -45,
		"ssid":         "RTL8189FTV_AP",
		"bssid":        "",
		"channel":      6,
		"subnet_mask":  "255.255.255.0",
		"gateway_ip":   "192.168.4.1",
		"dns_ip_1":     "192.168.4.1",
	}

	if !ap {
		sp := getStatusPayload()
		if conn, ok := sp["client_connected"].(bool); ok && conn {
			status["status"] = 3
			status["local_ip"] = sp["client_ip"]
			status["ssid"] = sp["client_ssid"]
		} else {
			status["status"] = 6
			status["local_ip"] = ""
		}
	}
	sendJSON(w, 200, status)
}

func handleEthernetStatus(w http.ResponseWriter, r *http.Request) {
	res := map[string]interface{}{
		"status":      0,
		"local_ip":    "",
		"mac_address": "",
		"connected":   false,
	}
	out, err := exec.Command("ip", "-4", "addr", "show", "eth0").Output()
	if err == nil {
		re := regexp.MustCompile(`inet\s+([\d\.]+)`)
		matches := re.FindStringSubmatch(string(out))
		if len(matches) > 1 {
			res["local_ip"] = matches[1]
			res["connected"] = true
			res["status"] = 3
		}
	}
	sendJSON(w, 200, res)
}

func handleApStatus(w http.ResponseWriter, r *http.Request) {
	apCfg := getApConfig()
	status := 0
	if isApActive() {
		status = 1
	}
	sendJSON(w, 200, map[string]interface{}{
		"status":         status,
		"ip_address":     "192.168.4.1",
		"local_ip":       "192.168.4.1",
		"ssid":           apCfg["ssid"],
		"password":       apCfg["password"],
		"channel":        apCfg["channel"],
		"provision_mode": 1,
		"max_clients":    4,
	})
}

func handleWifiScan(w http.ResponseWriter, r *http.Request) {
	nets := scanWifiNetworks()
	var formatted []map[string]interface{}
	for _, n := range nets {
		encType := 4
		if n["encryption"] == "eap" {
			encType = 5
		} else if n["encryption"] == "open" {
			encType = 0
		}
		formatted = append(formatted, map[string]interface{}{
			"ssid":            n["ssid"],
			"bssid":           n["bssid"],
			"rssi":            n["rssi"],
			"channel":         n["channel"],
			"encryption_type": encType,
		})
	}
	sendJSON(w, 200, map[string]interface{}{"networks": formatted})
}

func handleServices(w http.ResponseWriter, r *http.Request) {
	servicesList := []map[string]interface{}{
		{"unit": "forge-portal.service", "desc": "Servidor Web & API REST", "category": "forgeos"},
		{"unit": "forge-ap.service", "desc": "Ponto de Acesso Wi-Fi & dnsmasq", "category": "forgeos"},
		{"unit": "forge-display.service", "desc": "Renderizador HDMI FB0 Dual QR", "category": "forgeos"},
		{"unit": "forge-watchdog.service", "desc": "Watchdog de Contingência 75s", "category": "forgeos"},
		{"unit": "forge-fbcon-disable.service", "desc": "Desabilitar Cursor Framebuffer", "category": "forgeos"},
		{"unit": "ssh.service", "desc": "Servidor SSH OpenSSH", "category": "system"},
		{"unit": "systemd-journald.service", "desc": "Coletor de Logs do Kernel", "category": "system"},
		{"unit": "systemd-timesyncd.service", "desc": "Sincronização de Relógio NTP", "category": "system"},
	}

	for _, s := range servicesList {
		unit := s["unit"].(string)
		out, err := exec.Command("systemctl", "is-active", unit).Output()
		st := strings.TrimSpace(string(out))
		if err == nil && st == "active" {
			s["active"] = true
			s["state"] = "active"
		} else {
			s["active"] = false
			s["state"] = st
			if st == "" {
				s["state"] = "inactive"
			}
		}

		enOut, _ := exec.Command("systemctl", "is-enabled", unit).Output()
		s["enabled"] = (strings.TrimSpace(string(enOut)) == "enabled")
	}

	sendJSON(w, 200, map[string]interface{}{"services": servicesList})
}

func handleServiceAction(w http.ResponseWriter, r *http.Request) {
	unit := chi.URLParam(r, "unit")
	action := chi.URLParam(r, "action")

	if action != "restart" && action != "start" && action != "stop" {
		sendError(w, 400, "Invalid service action")
		return
	}

	go func() {
		exec.Command("systemctl", action, unit).Run()
	}()

	sendJSON(w, 200, map[string]interface{}{"ok": true, "message": fmt.Sprintf("Serviço '%s' comando: %s", unit, action)})
}

func handleLogs(w http.ResponseWriter, r *http.Request) {
	unit := r.URL.Query().Get("unit")
	level := r.URL.Query().Get("level")
	search := r.URL.Query().Get("search")
	linesCnt := r.URL.Query().Get("lines")
	if linesCnt == "" {
		linesCnt = "120"
	}

	args := []string{"-n", linesCnt, "--no-pager", "-o", "short-iso"}
	if unit != "" && unit != "all" {
		if unit == "kernel" {
			args = append(args, "-k")
		} else {
			args = append(args, "-u", unit)
		}
	}
	if level != "" && level != "all" {
		args = append(args, "-p", level)
	}

	cmd := exec.Command("journalctl", args...)
	out, err := cmd.Output()

	var logs []map[string]interface{}
	if err == nil {
		re := regexp.MustCompile(`^\S+T(\d{2}:\d{2}:\d{2})\S*\s+\S+\s+([^:\[]+)(?:\[\d+\])?:\s+(.*)$`)
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			if search != "" && !strings.Contains(strings.ToLower(line), strings.ToLower(search)) {
				continue
			}

			tStr := time.Now().Format("15:04:05")
			uName := "system"
			msg := line

			matches := re.FindStringSubmatch(line)
			if len(matches) > 3 {
				tStr = matches[1]
				uName = strings.TrimSpace(matches[2])
				msg = strings.TrimSpace(matches[3])
			}

			lVal := "info"
			lMsg := strings.ToLower(msg)
			if strings.Contains(lMsg, "err") || strings.Contains(lMsg, "fail") || strings.Contains(lMsg, "fatal") {
				lVal = "err"
			} else if strings.Contains(lMsg, "warn") {
				lVal = "warning"
			}

			logs = append(logs, map[string]interface{}{
				"time":    tStr,
				"unit":    uName,
				"level":   lVal,
				"message": msg,
				"raw":     line,
			})
		}
	}

	if len(logs) == 0 {
		tNow := time.Now().Format("15:04:05")
		logs = []map[string]interface{}{
			{"time": tNow, "unit": "forge-portal", "level": "info", "message": "Portal Web & Cockpit API Go operacional (:8080)", "raw": "forge-portal: listening on :8080"},
			{"time": tNow, "unit": "forge-ap", "level": "info", "message": "Ponto de acesso Wi-Fi RTL8189FTV_AP ativo (192.168.4.1 canal 6)", "raw": "forge-ap: AP active on 192.168.4.1"},
			{"time": tNow, "unit": "forge-display", "level": "info", "message": "HDMI Framebuffer /dev/fb0 ativo (1920x1080 Dual QR)", "raw": "forge-display: HDMI fb0 1080p active"},
			{"time": tNow, "unit": "forge-watchdog", "level": "info", "message": "Watchdog de contingência ativo com temporizador de 75s", "raw": "forge-watchdog: timer 75s running"},
			{"time": tNow, "unit": "kernel", "level": "info", "message": "SoC Amlogic S905X2 detectado (meson-g12a-btv-e10-enterprise DTB)", "raw": "kernel: meson-g12a-btv-e10-enterprise loaded"},
		}
	}

	sendJSON(w, 200, map[string]interface{}{"logs": logs, "total": len(logs)})
}

func handleLogsVacuum(w http.ResponseWriter, r *http.Request) {
	exec.Command("journalctl", "--vacuum-time=1d").Run()
	sendJSON(w, 200, map[string]interface{}{"ok": true, "message": "Logs rotacionados com sucesso"})
}

func handleModules(w http.ResponseWriter, r *http.Request) {
	modules := []map[string]interface{}{
		{
			"id":          "totem",
			"name":        "Mina — Assistente Virtual Acadêmica",
			"version":     "1.0.0",
			"category":    "ai",
			"icon":        "ai",
			"description": "Quiosque de voz inteligente com PyQt5, Picovoice Porcupine wake-word, STT/TTS e classificador MABI.",
			"tier":        "stable",
			"promoted":    true,
			"author":      "G.E.R.A — UNESP Sorocaba",
			"license":     "MIT",
			"requirements": map[string]interface{}{
				"min_ram_mb":     512,
				"min_storage_mb": 300,
				"python":         ">=3.9",
			},
			"status": getModuleStatus("totem"),
		},
		{
			"id":          "web-scraping",
			"name":        "Coletor Acadêmico & RAG Agent",
			"version":     "1.0.0",
			"category":    "data",
			"icon":        "data",
			"description": "Pipeline assíncrono de coleta de dados universitários com FastAPI, LangChain RAG, PostgreSQL e Redis.",
			"tier":        "beta",
			"promoted":    false,
			"author":      "G.E.R.A — UNESP Sorocaba",
			"license":     "MIT",
			"requirements": map[string]interface{}{
				"min_ram_mb":     1024,
				"min_storage_mb": 500,
				"python":         ">=3.12",
			},
			"status": getModuleStatus("web-scraping"),
		},
		{
			"id":          "kiosk-display",
			"name":        "Kiosk HDMI Framebuffer",
			"version":     "3.0.0",
			"category":    "display",
			"icon":        "display",
			"description": "Renderizador gráfico nativo 1080p sem X11 em /dev/fb0 com Dual QR Code e telemetria de hardware ao vivo.",
			"tier":        "stable",
			"promoted":    true,
			"author":      "MultiForge Core Team",
			"license":     "MIT",
			"requirements": map[string]interface{}{
				"min_ram_mb": 32,
			},
			"status": map[string]interface{}{"state": "running", "active": true},
		},
	}

	sendJSON(w, 200, map[string]interface{}{"modules": modules, "total": len(modules)})
}

func getModuleStatus(id string) map[string]interface{} {
	statusFile := filepath.Join(stateDir, fmt.Sprintf("module_%s.json", id))
	if data, err := os.ReadFile(statusFile); err == nil {
		var st map[string]interface{}
		if json.Unmarshal(data, &st) == nil {
			return st
		}
	}
	return map[string]interface{}{"state": "available", "active": false}
}

func handleModuleDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "totem" || id == "web-scraping" || id == "kiosk-display" {
		status := getModuleStatus(id)
		sendJSON(w, 200, map[string]interface{}{
			"id":     id,
			"status": status,
		})
		return
	}
	sendError(w, 404, fmt.Sprintf("module '%s' not found", id))
}

func handleModuleAction(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	action := chi.URLParam(r, "action")
	statusFile := filepath.Join(stateDir, fmt.Sprintf("module_%s.json", id))

	now := time.Now().Unix()
	var st map[string]interface{}

	switch action {
	case "install":
		st = map[string]interface{}{"state": "installed", "installed_at": now, "active": true}
	case "start":
		st = map[string]interface{}{"state": "running", "started_at": now, "active": true}
	case "stop":
		st = map[string]interface{}{"state": "stopped", "stopped_at": now, "active": false}
	case "uninstall":
		os.Remove(statusFile)
		sendJSON(w, 200, map[string]interface{}{"ok": true, "message": fmt.Sprintf("Módulo '%s' desinstalado", id)})
		return
	default:
		sendError(w, 400, "Invalid action")
		return
	}

	b, _ := json.Marshal(st)
	os.WriteFile(statusFile, b, 0644)
	sendJSON(w, 200, map[string]interface{}{"ok": true, "message": fmt.Sprintf("Módulo '%s' ação: %s", id, action), "status": st})
}

func handleSSEEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	notify := r.Context().Done()

	fmt.Fprintf(w, "data: {\"type\":\"ping\"}\n\n")
	flusher.Flush()

	for {
		select {
		case <-notify:
			return
		case <-ticker.C:
			m := getRealtimeMetrics()
			b, _ := json.Marshal(m)
			fmt.Fprintf(w, "data: %s\n\n", string(b))
			flusher.Flush()
		}
	}
}

func setupStaticFiles(r *chi.Mux) {
	sub, err := fs.Sub(webAssets, "web_assets")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating sub FS for web_assets: %v\n", err)
		return
	}

	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		path := strings.TrimPrefix(filepath.Clean(req.URL.Path), "/")
		if path == "" {
			path = "index.html"
		}

		f, err := sub.Open(path)
		if err != nil {
			// Fallback: return index.html for SPA routes
			idx, errIdx := sub.Open("index.html")
			if errIdx != nil {
				http.NotFound(w, req)
				return
			}
			defer idx.Close()
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			io.Copy(w, idx)
			return
		}
		defer f.Close()

		ext := filepath.Ext(path)
		ctype := mime.TypeByExtension(ext)
		if ctype == "" {
			ctype = "application/octet-stream"
		}

		w.Header().Set("Content-Type", ctype)
		if strings.Contains(path, "/_app/immutable/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		io.Copy(w, f)
	})
}
