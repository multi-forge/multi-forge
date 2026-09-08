package main

import (
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"forgehub/internal/api"
	"forgehub/internal/proxy"
	"forgehub/internal/store"
	"forgehub/internal/telemetry"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

//go:embed all:web_assets
var webAssets embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Init bbolt store with safe fallback
	dbPath := "/opt/multiforge/state/forgehub.db"
	if _, err := os.Stat("/opt/multiforge"); os.IsNotExist(err) {
		_ = os.MkdirAll("./data", 0755)
		dbPath = "./data/forgehub.db"
	}
	db, err := store.InitDB(dbPath)
	if err != nil {
		log.Printf("[WARN] Initializing in-memory/temp DB fallback: %v", err)
	}
	if db != nil {
		defer db.Close()
	}

	// Dynamic Reverse Proxy Manager
	pm := proxy.NewDynamicProxyManager()

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Debug-Simulate-Memory"},
		ExposedHeaders:   []string{"Link", "X-Forwarded-Prefix"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Setup API routes
	api.InitAPI(r, db, pm)

	// Embedded Static File Server with SPA Fallback
	setupStaticFiles(r)

	// Wrap Chi router with Dynamic Reverse Proxy Handler
	rootHandler := pm.Handler(r)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: rootHandler,
	}

	idleConnsClosed := make(chan struct{})
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		log.Println("[INFO] Shutting down ForgeHub daemon...")
		telemetry.DefaultBroker.Stop()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("[ERROR] HTTP server shutdown error: %v", err)
		}
		close(idleConnsClosed)
	}()

	fmt.Printf("[FORGEHUB] Enterprise Edge Daemon started on :%s (RSS target <= 15MB)\n", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("[FATAL] HTTP listen failed: %v", err)
	}

	<-idleConnsClosed
	log.Println("[INFO] Daemon exited cleanly.")
}

func setupStaticFiles(r chi.Router) {
	sub, err := fs.Sub(webAssets, "web_assets")
	if err != nil {
		log.Printf("[WARN] Sub fs error: %v", err)
		return
	}

	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		reqPath := strings.TrimPrefix(path.Clean(req.URL.Path), "/")
		if reqPath == "" || reqPath == "." {
			reqPath = "index.html"
		}

		f, err := sub.Open(reqPath)
		if err != nil {
			// SPA fallback: return index.html
			idx, errIdx := sub.Open("index.html")
			if errIdx != nil {
				http.NotFound(w, req)
				return
			}
			defer idx.Close()
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			_, _ = io.Copy(w, idx)
			return
		}
		defer f.Close()

		ext := path.Ext(reqPath)
		ctype := mime.TypeByExtension(ext)
		if ctype == "" {
			if strings.HasSuffix(reqPath, ".js") {
				ctype = "application/javascript"
			} else if strings.HasSuffix(reqPath, ".css") {
				ctype = "text/css"
			} else {
				ctype = "application/octet-stream"
			}
		}

		w.Header().Set("Content-Type", ctype)
		if strings.Contains(reqPath, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		_, _ = io.Copy(w, f)
	})
}
