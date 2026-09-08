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
	if _, ok := body["ap_active"].(bool); !ok {
		t.Fatalf("ap_active must be boolean")
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
	if body["ap_ip"] != "192.168.4.1" {
		t.Fatalf("expected ap_ip 192.168.4.1, got %v", body["ap_ip"])
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
	if !ok || len(networks) < 2 {
		t.Fatalf("expected networks array of at least 2 items, got %v", networks)
	}
}

