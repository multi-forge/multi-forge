package proxy

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"
)

type Route struct {
	ModuleID  string `json:"module_id"`
	Path      string `json:"path"`
	TargetURL string `json:"target_url"`
}

type DynamicProxyManager struct {
	mu        sync.RWMutex
	routes    map[string]*httputil.ReverseProxy
	routeMeta map[string]Route
}

func NewDynamicProxyManager() *DynamicProxyManager {
	return &DynamicProxyManager{
		routes:    make(map[string]*httputil.ReverseProxy),
		routeMeta: make(map[string]Route),
	}
}

func (dpm *DynamicProxyManager) RegisterRoute(prefix string, target string, moduleID string) error {
	u, err := url.Parse(target)
	if err != nil {
		return fmt.Errorf("invalid target url: %w", err)
	}

	cleanPrefix := "/" + strings.Trim(prefix, "/")

	dpm.mu.Lock()
	defer dpm.mu.Unlock()

	// Collision check
	if existing, exists := dpm.routeMeta[cleanPrefix]; exists {
		if existing.ModuleID != moduleID {
			return fmt.Errorf("route already registered by module '%s'", existing.ModuleID)
		}
	}

	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(u)
			pr.Out.Header.Set("X-Forwarded-Prefix", cleanPrefix)
			pr.Out.Header.Set("X-Forwarded-Host", pr.In.Host)

			// Strip cleanPrefix from URL path
			origPath := pr.In.URL.Path
			if strings.HasPrefix(origPath, cleanPrefix) {
				newPath := strings.TrimPrefix(origPath, cleanPrefix)
				if !strings.HasPrefix(newPath, "/") {
					newPath = "/" + newPath
				}
				pr.Out.URL.Path = newPath
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Set("X-Forwarded-Prefix", cleanPrefix)
			return nil
		},
		FlushInterval: 100 * time.Millisecond,
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "bad_gateway",
				"message": fmt.Sprintf("Module upstream unreachable: %v", err),
			})
		},
	}

	dpm.routes[cleanPrefix] = proxy
	dpm.routeMeta[cleanPrefix] = Route{
		ModuleID:  moduleID,
		Path:      cleanPrefix,
		TargetURL: target,
	}
	return nil
}

func (dpm *DynamicProxyManager) DeregisterRoute(prefix string) bool {
	cleanPrefix := "/" + strings.Trim(prefix, "/")
	dpm.mu.Lock()
	defer dpm.mu.Unlock()
	if _, exists := dpm.routes[cleanPrefix]; exists {
		delete(dpm.routes, cleanPrefix)
		delete(dpm.routeMeta, cleanPrefix)
		return true
	}
	return false
}

func (dpm *DynamicProxyManager) DeregisterByModule(moduleID string) bool {
	dpm.mu.Lock()
	defer dpm.mu.Unlock()
	found := false
	for prefix, meta := range dpm.routeMeta {
		if meta.ModuleID == moduleID {
			delete(dpm.routes, prefix)
			delete(dpm.routeMeta, prefix)
			found = true
		}
	}
	return found
}

func (dpm *DynamicProxyManager) HasRoute(prefix string) bool {
	cleanPrefix := "/" + strings.Trim(prefix, "/")
	dpm.mu.RLock()
	defer dpm.mu.RUnlock()
	_, exists := dpm.routes[cleanPrefix]
	return exists
}

func (dpm *DynamicProxyManager) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqPath := r.URL.Path

		dpm.mu.RLock()
		var matchedProxy *httputil.ReverseProxy
		for prefix, proxy := range dpm.routes {
			if reqPath == prefix || strings.HasPrefix(reqPath, prefix+"/") {
				matchedProxy = proxy
				break
			}
		}
		dpm.mu.RUnlock()

		if matchedProxy != nil {
			matchedProxy.ServeHTTP(w, r)
			return
		}

		// If path begins with /app/ but no route is registered, return HTTP 503 with JSON
		if strings.HasPrefix(reqPath, "/app/") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":   "service_unavailable",
				"message": "Module route not registered or module stopped",
			})
			return
		}

		if next != nil {
			next.ServeHTTP(w, r)
			return
		}
		http.NotFound(w, r)
	})
}
