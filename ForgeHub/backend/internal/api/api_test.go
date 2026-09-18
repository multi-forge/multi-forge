package api

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"forgehub/internal/proxy"
	"forgehub/internal/store"

	"github.com/go-chi/chi/v5"
)

func setupTestAPI(t *testing.T) (*chi.Mux, func()) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "forgehub-api-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := store.InitDB(dbPath)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		t.Fatalf("failed to init db: %v", err)
	}

	pm := proxy.NewDynamicProxyManager()
	r := chi.NewRouter()
	InitAPI(r, db, pm)

	cleanup := func() {
		_ = db.Close()
		_ = os.RemoveAll(tmpDir)
	}
	return r, cleanup
}

func TestStatusEndpoint(t *testing.T) {
	r, cleanup := setupTestAPI(t)
	defer cleanup()

	// 1. GET /api/status
	req, _ := http.NewRequest("GET", "/api/status", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", rec.Code)
	}

	// Cache-Control headers
	cc := rec.Header().Get("Cache-Control")
	if !strings.Contains(cc, "no-cache") && !strings.Contains(cc, "no-store") {
		t.Fatalf("expected Cache-Control to prevent caching, got '%s'", cc)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse status JSON: %v", err)
	}

	// Verify mandatory fields
	if apActive, ok := body["ap_active"].(bool); !ok {
		t.Fatalf("ap_active must be boolean")
	} else if apActive {
		// On hardware with the AP up, the fixed AP address/SSID apply.
		if body["ap_ip"] != "192.168.4.1" {
			t.Fatalf("expected ap_ip 192.168.4.1 when AP active, got %v", body["ap_ip"])
		}
		if ssid, ok := body["ap_ssid"].(string); !ok || ssid == "" {
			t.Fatalf("ap_ssid must be non-empty when AP active, got %v", body["ap_ssid"])
		}
	} else if body["ap_ip"] != "" {
		t.Fatalf("expected empty ap_ip when AP inactive, got %v", body["ap_ip"])
	}
	if _, ok := body["provisioning"].(bool); !ok {
		t.Fatalf("provisioning must be boolean")
	}
	if _, ok := body["client_connected"].(bool); !ok {
		t.Fatalf("client_connected must be boolean")
	}
	if model, ok := body["device_model"].(string); !ok || model == "" {
		t.Fatalf("device_model must be non-empty string, got %v", body["device_model"])
	}
	uptime, ok := body["uptime"].(float64)
	if !ok || uptime < 0 {
		t.Fatalf("uptime must be non-negative number, got %v", body["uptime"])
	}
	freeRAM, ok := body["free_ram_mb"].(float64)
	if !ok || freeRAM <= 0 {
		t.Fatalf("free_ram_mb must be > 0, got %v", body["free_ram_mb"])
	}

	// 2. Monotonic uptime test
	time.Sleep(100 * time.Millisecond)
	req2, _ := http.NewRequest("GET", "/api/status", nil)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	var body2 map[string]interface{}
	_ = json.Unmarshal(rec2.Body.Bytes(), &body2)
	uptime2 := body2["uptime"].(float64)
	if uptime2 < uptime {
		t.Fatalf("uptime must be monotonic non-decreasing: %f < %f", uptime2, uptime)
	}

	// 3. Method Not Allowed (POST /api/status -> 405)
	reqPost, _ := http.NewRequest("POST", "/api/status", strings.NewReader(`{"test":true}`))
	recPost := httptest.NewRecorder()
	r.ServeHTTP(recPost, reqPost)
	if recPost.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected HTTP 405 for POST /api/status, got %d", recPost.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	r, cleanup := setupTestAPI(t)
	defer cleanup()

	start := time.Now()
	req, _ := http.NewRequest("GET", "/api/metrics", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	latency := time.Since(start)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", rec.Code)
	}

	// SLA < 50ms check
	if latency > 50*time.Millisecond {
		t.Fatalf("SLA violation: /api/metrics took %v (> 50ms)", latency)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("failed to parse metrics JSON: %v", err)
	}

	cpuPct, ok := m["cpu_percent"].(float64)
	if !ok || cpuPct < 0 || cpuPct > 100 {
		t.Fatalf("cpu_percent must be within [0, 100], got %v", m["cpu_percent"])
	}

	temp, ok := m["temp_celsius"].(float64)
	if !ok || temp < 25 || temp > 95 {
		t.Fatalf("temp_celsius must be within [25, 95], got %v", m["temp_celsius"])
	}

	totalRAM, ok := m["ram_total_mb"].(float64)
	if !ok || totalRAM < 1500 || totalRAM > 2100 {
		t.Fatalf("ram_total_mb must be within [1500, 2100], got %v", m["ram_total_mb"])
	}

	usedRAM, ok := m["ram_used_mb"].(float64)
	if !ok || usedRAM < 0 {
		t.Fatalf("ram_used_mb must be >= 0, got %v", m["ram_used_mb"])
	}

	freeRAM, ok := m["ram_free_mb"].(float64)
	if !ok || freeRAM <= 0 {
		t.Fatalf("ram_free_mb must be > 0, got %v", m["ram_free_mb"])
	}

	// Strict memory accounting coherence
	if usedRAM+freeRAM != totalRAM {
		t.Fatalf("Memory coherence failure: used (%.0f) + free (%.0f) != total (%.0f)", usedRAM, freeRAM, totalRAM)
	}

	diskTotal, ok := m["disk_total_gb"].(float64)
	if !ok || diskTotal <= 0 {
		t.Fatalf("disk_total_gb must be > 0, got %v", m["disk_total_gb"])
	}
}

func TestEventsSSEEndpoint(t *testing.T) {
	r, cleanup := setupTestAPI(t)
	defer cleanup()

	server := httptest.NewServer(r)
	defer server.Close()

	req, err := http.NewRequest("GET", server.URL+"/api/events", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to connect to /api/events: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", resp.StatusCode)
	}

	ctype := resp.Header.Get("Content-Type")
	if !strings.Contains(ctype, "text/event-stream") {
		t.Fatalf("expected text/event-stream, got '%s'", ctype)
	}

	reader := bufio.NewReader(resp.Body)

	// Verify immediate initial telemetry event
	line1, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("failed to read line1: %v", err)
	}
	line2, err := reader.ReadString('\n')
	if err != nil {
		t.Fatalf("failed to read line2: %v", err)
	}

	if !strings.HasPrefix(line1, "event: telemetry") {
		t.Fatalf("expected event: telemetry, got: %s", line1)
	}
	if !strings.HasPrefix(line2, "data: ") {
		t.Fatalf("expected data line, got: %s", line2)
	}

	dataStr := strings.TrimPrefix(strings.TrimSpace(line2), "data: ")
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(dataStr), &m); err != nil {
		t.Fatalf("failed to parse SSE data JSON: %v", err)
	}
	if _, ok := m["ram_total_mb"]; !ok {
		t.Fatalf("SSE data missing ram_total_mb: %v", dataStr)
	}
}

func TestWifiScanParsing(t *testing.T) {
	rawIwlist := `wlan0     Scan completed :
          Cell 01 - Address: 80:03:84:0F:32:48
                    ESSID:"IFSP-Servidores"
                    Protocol:IEEE 802.11bgn
                    Mode:Master
                    Frequency:2.437 GHz (Channel 6)
                    Encryption key:on
                    IE: IEEE 802.11i/WPA2 Version 1
                        Authentication Suites (2) : 802.1x unknown (5)
                    Quality=60/100  Signal level=45/100  
          Cell 02 - Address: 80:03:84:4F:32:48
                    ESSID:"IFSP-IOT"
                    Protocol:IEEE 802.11bgn
                    Mode:Master
                    Frequency:2.437 GHz (Channel 6)
                    Encryption key:on
                    IE: IEEE 802.11i/WPA2 Version 1
                        Authentication Suites (2) : PSK unknown (8)
                    Quality=66/100  Signal level=60/100  
          Cell 03 - Address: 80:03:84:0F:32:49
                    ESSID:"eduroam"
                    Protocol:IEEE 802.11bgn
                    Mode:Master
                    Frequency:2.437 GHz (Channel 6)
                    Encryption key:on
                    IE: IEEE 802.11i/WPA2 Version 1
                        Authentication Suites (2) : 802.1x unknown (5)
                    Quality=50/100  Signal level=30/100  
`
	nets := parseIwlistScan(rawIwlist)
	if len(nets) < 3 {
		t.Fatalf("expected at least 3 networks, got %d", len(nets))
	}

	hasPSK := false
	hasEAP := false
	for _, n := range nets {
		rssi := n["rssi"].(int)
		if rssi < -100 || rssi > -20 {
			t.Fatalf("rssi %d out of bounds [-100, -20]", rssi)
		}
		if n["encryption"] == "psk" {
			hasPSK = true
		}
		if n["encryption"] == "eap" {
			hasEAP = true
		}
	}
	if !hasPSK || !hasEAP {
		t.Fatalf("expected both PSK and EAP networks, got hasPSK=%v, hasEAP=%v", hasPSK, hasEAP)
	}
}

func TestIwScanParsing(t *testing.T) {
	rawIw := `BSS 80:03:84:0f:32:48(on wlan1)
	TSF: 123456789 usec (0d, 00:02:03)
	freq: 2437
	beacon interval: 100 TUs
	capability: ESS Privacy ShortPreamble ShortSlotTime (0x0431)
	signal: -62.00 dBm
	last seen: 1000 ms ago
	SSID: IFSP-Servidores
	RSN:	 * Version: 1
		 * Authentication suites: 802.1x
	BSS 80:03:84:4f:32:48(on wlan1)
	TSF: 123456790 usec (0d, 00:02:03)
	freq: 2437
	signal: -55.00 dBm
	SSID: IFSP-IOT
	RSN:	 * Version: 1
		 * Authentication suites: PSK
	BSS 80:03:84:0f:32:49(on wlan1)
	TSF: 123456791 usec (0d, 00:02:03)
	freq: 2462
	signal: -71.00 dBm
	SSID: eduroam
	DS Parameter set: channel 11
	RSN:	 * Version: 1
		 * Authentication suites: 802.1x
	BSS 88:c3:97:d5:81:91(on wlan1)
	TSF: 123456792 usec (0d, 00:02:03)
	freq: 2437
	signal: -80.00 dBm
	SSID: OpenWrt
`
	nets := parseIwScan(rawIw)
	if len(nets) != 4 {
		t.Fatalf("expected 4 networks, got %d", len(nets))
	}
	bySSID := map[string]map[string]interface{}{}
	for _, n := range nets {
		bySSID[n["ssid"].(string)] = n
	}
	if bySSID["eduroam"]["encryption"] != "eap" {
		t.Fatalf("eduroam must be eap, got %v", bySSID["eduroam"]["encryption"])
	}
	if bySSID["IFSP-IOT"]["encryption"] != "psk" {
		t.Fatalf("IFSP-IOT must be psk, got %v", bySSID["IFSP-IOT"]["encryption"])
	}
	if bySSID["OpenWrt"]["encryption"] != "open" {
		t.Fatalf("OpenWrt must be open, got %v", bySSID["OpenWrt"]["encryption"])
	}
	if rssi := bySSID["eduroam"]["rssi"].(int); rssi != -71 {
		t.Fatalf("eduroam rssi must be -71, got %d", rssi)
	}
	if ch := bySSID["IFSP-Servidores"]["channel"].(int); ch != 0 {
		t.Fatalf("channel without DS set defaults to 0, got %d", ch)
	}
	if ch := bySSID["eduroam"]["channel"].(int); ch != 11 {
		t.Fatalf("eduroam channel must be 11, got %d", ch)
	}
	// No placeholder networks may ever be injected: parsed output must
	// contain exactly the BSS entries from the scan.
	if len(bySSID) != 4 {
		t.Fatalf("unexpected networks injected: %v", bySSID)
	}
}

func TestScanEndpoint(t *testing.T) {
	r, cleanup := setupTestAPI(t)
	defer cleanup()

	start := time.Now()
	req, _ := http.NewRequest("GET", "/api/scan", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	latency := time.Since(start)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", rec.Code)
	}
	if latency > 50*time.Millisecond {
		t.Fatalf("SLA violation: /api/scan took %v (> 50ms)", latency)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}
	networks, ok := body["networks"].([]interface{})
	if !ok {
		t.Fatalf("expected networks array (including an empty scan), got %v", networks)
	}
}

