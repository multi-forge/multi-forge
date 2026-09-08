package telemetry

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Broker manages real-time Server-Sent Events (SSE) subscriptions for telemetry and pings.
type Broker struct {
	mu           sync.RWMutex
	clients      map[chan []byte]struct{}
	register     chan chan []byte
	unregister   chan chan []byte
	broadcast    chan []byte
	stop         chan struct{}
	running      bool
	tickerPeriod time.Duration
}

// DefaultBroker is the singleton broker used across ForgeHub.
var DefaultBroker *Broker

func init() {
	DefaultBroker = NewBroker(1 * time.Second)
	DefaultBroker.Start()
}

// NewBroker creates a new SSE broker.
func NewBroker(tickerPeriod time.Duration) *Broker {
	if tickerPeriod <= 0 {
		tickerPeriod = 1 * time.Second
	}
	return &Broker{
		clients:      make(map[chan []byte]struct{}),
		register:     make(chan chan []byte, 32),
		unregister:   make(chan chan []byte, 32),
		broadcast:    make(chan []byte, 128),
		stop:         make(chan struct{}),
		tickerPeriod: tickerPeriod,
	}
}

// Start begins the broker event loop and periodic ticker.
func (b *Broker) Start() {
	b.mu.Lock()
	if b.running {
		b.mu.Unlock()
		return
	}
	b.running = true
	b.mu.Unlock()

	go b.eventLoop()
	go b.tickerLoop()
}

// Stop terminates the broker.
func (b *Broker) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.running {
		return
	}
	b.running = false
	close(b.stop)
}

func (b *Broker) eventLoop() {
	for {
		select {
		case <-b.stop:
			b.mu.Lock()
			for ch := range b.clients {
				close(ch)
				delete(b.clients, ch)
			}
			b.mu.Unlock()
			return

		case client := <-b.register:
			b.mu.Lock()
			b.clients[client] = struct{}{}
			b.mu.Unlock()

		case client := <-b.unregister:
			b.mu.Lock()
			if _, ok := b.clients[client]; ok {
				delete(b.clients, client)
				close(client)
			}
			b.mu.Unlock()

		case msg := <-b.broadcast:
			b.mu.RLock()
			for client := range b.clients {
				select {
				case client <- msg:
				default:
					// Drop event for slow/lagging consumer to prevent blocking other clients
				}
			}
			b.mu.RUnlock()
		}
	}
}

func (b *Broker) tickerLoop() {
	ticker := time.NewTicker(b.tickerPeriod)
	defer ticker.Stop()

	tickCount := 0
	for {
		select {
		case <-b.stop:
			return
		case <-ticker.C:
			tickCount++
			// 1. Broadcast telemetry event
			m := GetMetrics()
			data, err := json.Marshal(m)
			if err == nil {
				msg := fmt.Sprintf("event: telemetry\ndata: %s\n\n", string(data))
				b.Broadcast([]byte(msg))
			}

			// 2. Broadcast ping event every tick
			pingData, _ := json.Marshal(map[string]interface{}{
				"timestamp": time.Now().Unix(),
				"seq":       tickCount,
			})
			pingMsg := fmt.Sprintf("event: ping\ndata: %s\n\n", string(pingData))
			b.Broadcast([]byte(pingMsg))
		}
	}
}

// Broadcast sends a formatted SSE event to all connected clients.
func (b *Broker) Broadcast(msg []byte) {
	b.mu.RLock()
	running := b.running
	b.mu.RUnlock()
	if !running {
		return
	}
	select {
	case b.broadcast <- msg:
	default:
	}
}

// ClientCount returns the number of currently active SSE subscribers.
func (b *Broker) ClientCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.clients)
}

// ServeHTTP handles incoming SSE HTTP requests from clients.
func (b *Broker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Channel for this client
	clientChan := make(chan []byte, 32)
	b.register <- clientChan
	defer func() {
		b.unregister <- clientChan
	}()

	// Deliver immediate initial telemetry event on connection (satisfying T1.3.2)
	initialMetrics := GetMetrics()
	if initialData, err := json.Marshal(initialMetrics); err == nil {
		_, _ = fmt.Fprintf(w, "event: telemetry\ndata: %s\n\n", string(initialData))
		flusher.Flush()
	}

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			// Client disconnected cleanly
			return
		case msg, ok := <-clientChan:
			if !ok {
				return
			}
			_, err := w.Write(msg)
			if err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
