package telemetry

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestGetMetrics(t *testing.T) {
	// 1. Snapshot test
	m := GetMetrics()

	// CPU bounds
	if m.CPUPercent < 0.0 || m.CPUPercent > 100.0 {
		t.Fatalf("CPU percent out of range [0, 100]: %f", m.CPUPercent)
	}

	// Thermal bounds
	if m.TempCelsius < 25.0 || m.TempCelsius > 95.0 {
		t.Fatalf("Temp celsius out of range [25, 95]: %f", m.TempCelsius)
	}

	// RAM bounds and coherence
	if m.RAMTotalMB < 1500 || m.RAMTotalMB > 2100 {
		t.Fatalf("RAM total outside BTV E10 hardware envelope [1500, 2100]: %d", m.RAMTotalMB)
	}
	if m.RAMFreeMB <= 0 {
		t.Fatalf("RAM free must be > 0: %d", m.RAMFreeMB)
	}
	if m.RAMUsedMB < 0 {
		t.Fatalf("RAM used must be >= 0: %d", m.RAMUsedMB)
	}
	if m.RAMUsedMB+m.RAMFreeMB != m.RAMTotalMB {
		t.Fatalf("Memory coherence violated: used (%d) + free (%d) != total (%d)", m.RAMUsedMB, m.RAMFreeMB, m.RAMTotalMB)
	}

	// Disk
	if m.DiskTotalGB <= 0 {
		t.Fatalf("Disk total must be > 0: %f", m.DiskTotalGB)
	}

	// Network
	if m.NetRxKbps < 0 || m.NetTxKbps < 0 {
		t.Fatalf("Network throughput must be >= 0: rx=%f, tx=%f", m.NetRxKbps, m.NetTxKbps)
	}

	// SLA test: GetMetrics must respond in < 1ms
	start := time.Now()
	for i := 0; i < 100; i++ {
		_ = GetMetrics()
	}
	elapsed := time.Since(start)
	avgMicro := elapsed.Microseconds() / 100
	if avgMicro > 1000 {
		t.Fatalf("GetMetrics average latency too high: %d µs (must be < 1000 µs)", avgMicro)
	}
}

func TestSSEBroker(t *testing.T) {
	broker := NewBroker(50 * time.Millisecond)
	broker.Start()
	defer broker.Stop()

	server := httptest.NewServer(http.HandlerFunc(broker.ServeHTTP))
	defer server.Close()

	// 1. Single client test
	req, err := http.NewRequest("GET", server.URL, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to connect to SSE stream: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got: %d", res.StatusCode)
	}
	if !strings.Contains(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatalf("unexpected Content-Type: %s", res.Header.Get("Content-Type"))
	}

	reader := bufio.NewReader(res.Body)

	// Verify immediate telemetry event
	line1, _ := reader.ReadString('\n')
	line2, _ := reader.ReadString('\n')
	_, _ = reader.ReadString('\n') // empty line

	if !strings.HasPrefix(line1, "event: telemetry") {
		t.Fatalf("expected immediate telemetry event, got: %s", line1)
	}
	if !strings.HasPrefix(line2, "data: ") {
		t.Fatalf("expected data line, got: %s", line2)
	}

	var payload SystemMetrics
	dataStr := strings.TrimPrefix(strings.TrimSpace(line2), "data: ")
	if err := json.Unmarshal([]byte(dataStr), &payload); err != nil {
		t.Fatalf("failed to unmarshal SSE telemetry data: %v", err)
	}
	if payload.RAMTotalMB <= 0 {
		t.Fatalf("invalid payload: %+v", payload)
	}

	// Close client connection
	_ = res.Body.Close()

	// Wait for unregister to process
	time.Sleep(100 * time.Millisecond)
	if count := broker.ClientCount(); count != 0 {
		t.Fatalf("expected 0 clients after disconnect, got %d", count)
	}
}

func TestSSEBrokerMultiClient(t *testing.T) {
	broker := NewBroker(50 * time.Millisecond)
	broker.Start()
	defer broker.Stop()

	server := httptest.NewServer(http.HandlerFunc(broker.ServeHTTP))
	defer server.Close()

	var wg sync.WaitGroup
	numClients := 5

	for i := 0; i < numClients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := http.Get(server.URL)
			if err != nil {
				t.Errorf("multi-client get failed: %v", err)
				return
			}
			defer res.Body.Close()

			reader := bufio.NewReader(res.Body)
			// Read at least 2 events
			eventsReceived := 0
			for eventsReceived < 2 {
				line, err := reader.ReadString('\n')
				if err != nil {
					return
				}
				if strings.HasPrefix(line, "event: ") {
					eventsReceived++
				}
			}
		}()
	}

	wg.Wait()

	// Allow unregisters to complete
	time.Sleep(150 * time.Millisecond)
	if count := broker.ClientCount(); count != 0 {
		t.Fatalf("expected 0 clients remaining, got %d", count)
	}
}
