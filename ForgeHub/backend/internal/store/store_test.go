package store

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func createTempDB(t *testing.T) (*DB, string) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "forgehub-store-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := InitDB(dbPath)
	if err != nil {
		_ = os.RemoveAll(tmpDir)
		t.Fatalf("failed to init db: %v", err)
	}
	return db, tmpDir
}

func cleanupTempDB(db *DB, tmpDir string) {
	if db != nil {
		_ = db.Close()
	}
	_ = os.RemoveAll(tmpDir)
}

func TestModuleCRUD(t *testing.T) {
	db, tmpDir := createTempDB(t)
	defer cleanupTempDB(db, tmpDir)

	mod := &ModuleManifest{
		ID:          "mina-ia",
		Name:        "Mina Assistant",
		Version:     "1.0.0",
		Type:        "systemd",
		Category:    "ai",
		Icon:        "bot",
		Description: "Voice assistant",
		Port:        5000,
		ProxyPath:   "/app/mina-ia",
		MinRAMMB:    256,
		MinDiskMB:   300,
		Tier:        "stable",
		Author:      "UNESP",
		Status:      "stopped",
	}

	// 1. Save
	if err := db.SaveModule(mod); err != nil {
		t.Fatalf("SaveModule failed: %v", err)
	}

	// 2. Read
	got, err := db.GetModule("mina-ia")
	if err != nil {
		t.Fatalf("GetModule failed: %v", err)
	}
	if got.ID != mod.ID || got.Name != mod.Name || got.Port != 5000 || got.Status != "stopped" {
		t.Fatalf("GetModule returned unexpected data: %+v", got)
	}

	// 3. Update
	mod.Status = "running"
	mod.MinRAMMB = 512
	if err := db.SaveModule(mod); err != nil {
		t.Fatalf("SaveModule update failed: %v", err)
	}
	updated, err := db.GetModule("mina-ia")
	if err != nil {
		t.Fatalf("GetModule after update failed: %v", err)
	}
	if updated.Status != "running" || updated.MinRAMMB != 512 {
		t.Fatalf("GetModule update did not persist: %+v", updated)
	}

	// 4. List
	list, err := db.ListModules()
	if err != nil {
		t.Fatalf("ListModules failed: %v", err)
	}
	if len(list) != 1 || list[0].ID != "mina-ia" {
		t.Fatalf("ListModules returned unexpected count or data: %d items", len(list))
	}

	// 5. Delete
	if err := db.DeleteModule("mina-ia"); err != nil {
		t.Fatalf("DeleteModule failed: %v", err)
	}
	_, err = db.GetModule("mina-ia")
	if err != ErrNotFound {
		t.Fatalf("expected ErrNotFound after delete, got: %v", err)
	}

	// 6. List after delete
	listAfter, err := db.ListModules()
	if err != nil {
		t.Fatalf("ListModules after delete failed: %v", err)
	}
	if len(listAfter) != 0 {
		t.Fatalf("expected 0 modules, got %d", len(listAfter))
	}

	// 7. Error handling
	if err := db.SaveModule(nil); err != ErrNilRecord {
		t.Fatalf("expected ErrNilRecord for nil module, got: %v", err)
	}
	if err := db.SaveModule(&ModuleManifest{}); err != ErrEmptyKey {
		t.Fatalf("expected ErrEmptyKey for empty ID, got: %v", err)
	}
	if _, err := db.GetModule(""); err != ErrEmptyKey {
		t.Fatalf("expected ErrEmptyKey for empty ID, got: %v", err)
	}
}

func TestConfigCRUD(t *testing.T) {
	db, tmpDir := createTempDB(t)
	defer cleanupTempDB(db, tmpDir)

	// 1. Set
	if err := db.SetConfig("ap_ssid", "Forge-E10"); err != nil {
		t.Fatalf("SetConfig failed: %v", err)
	}

	// 2. Get
	val, err := db.GetConfig("ap_ssid")
	if err != nil {
		t.Fatalf("GetConfig failed: %v", err)
	}
	if val != "Forge-E10" {
		t.Fatalf("unexpected config value: %s", val)
	}

	// 3. Update
	if err := db.SetConfig("ap_ssid", "MultiForge-Updated"); err != nil {
		t.Fatalf("SetConfig update failed: %v", err)
	}
	valUpdated, err := db.GetConfig("ap_ssid")
	if err != nil {
		t.Fatalf("GetConfig updated failed: %v", err)
	}
	if valUpdated != "MultiForge-Updated" {
		t.Fatalf("unexpected updated config: %s", valUpdated)
	}

	// 4. Not found
	if _, err := db.GetConfig("non_existent"); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound for missing config, got: %v", err)
	}

	// 5. Empty key
	if err := db.SetConfig("", "val"); err != ErrEmptyKey {
		t.Fatalf("expected ErrEmptyKey, got: %v", err)
	}
	if _, err := db.GetConfig(""); err != ErrEmptyKey {
		t.Fatalf("expected ErrEmptyKey, got: %v", err)
	}
}

func TestProxyRoutesCRUD(t *testing.T) {
	db, tmpDir := createTempDB(t)
	defer cleanupTempDB(db, tmpDir)

	r1 := &RouteMeta{
		ModuleID:    "mina-ia",
		Path:        "/app/mina-ia",
		TargetURL:   "http://127.0.0.1:5000",
		StripPrefix: true,
	}
	r2 := &RouteMeta{
		ModuleID:    "mina-ia",
		Path:        "/app/mina-ia/ws",
		TargetURL:   "http://127.0.0.1:5001",
		StripPrefix: false,
	}
	r3 := &RouteMeta{
		ModuleID:    "web-scraping",
		Path:        "/app/web-scraping",
		TargetURL:   "http://127.0.0.1:8000",
		StripPrefix: true,
	}

	// 1. Save
	if err := db.SaveRoute(r1); err != nil {
		t.Fatalf("SaveRoute r1 failed: %v", err)
	}
	if err := db.SaveRoute(r2); err != nil {
		t.Fatalf("SaveRoute r2 failed: %v", err)
	}
	if err := db.SaveRoute(r3); err != nil {
		t.Fatalf("SaveRoute r3 failed: %v", err)
	}

	// 2. Get
	gotR1, err := db.GetRoute("/app/mina-ia")
	if err != nil {
		t.Fatalf("GetRoute failed: %v", err)
	}
	if gotR1.ModuleID != "mina-ia" || gotR1.TargetURL != "http://127.0.0.1:5000" || !gotR1.StripPrefix {
		t.Fatalf("unexpected route data: %+v", gotR1)
	}

	// 3. List
	routes, err := db.ListRoutes()
	if err != nil {
		t.Fatalf("ListRoutes failed: %v", err)
	}
	if len(routes) != 3 {
		t.Fatalf("expected 3 routes, got %d", len(routes))
	}

	// 4. Delete by Module
	if err := db.DeleteRouteByModule("mina-ia"); err != nil {
		t.Fatalf("DeleteRouteByModule failed: %v", err)
	}
	routesAfterModDelete, err := db.ListRoutes()
	if err != nil {
		t.Fatalf("ListRoutes failed: %v", err)
	}
	if len(routesAfterModDelete) != 1 || routesAfterModDelete[0].ModuleID != "web-scraping" {
		t.Fatalf("expected 1 remaining route for web-scraping, got: %d", len(routesAfterModDelete))
	}

	// 5. Delete specific route
	if err := db.DeleteRoute("/app/web-scraping"); err != nil {
		t.Fatalf("DeleteRoute failed: %v", err)
	}
	_, err = db.GetRoute("/app/web-scraping")
	if err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got: %v", err)
	}
}

func TestPersistenceAcrossCloseReopen(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "forgehub-persist-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	dbPath := filepath.Join(tmpDir, "persist.db")

	// 1. Open and insert records
	db1, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB db1 failed: %v", err)
	}

	mod := &ModuleManifest{
		ID:     "persist-mod",
		Name:   "Persist Module",
		Port:   9000,
		Status: "running",
	}
	if err := db1.SaveModule(mod); err != nil {
		t.Fatalf("SaveModule failed: %v", err)
	}
	if err := db1.SetConfig("boot_count", "42"); err != nil {
		t.Fatalf("SetConfig failed: %v", err)
	}
	if err := db1.SaveRoute(&RouteMeta{ModuleID: "persist-mod", Path: "/app/persist", TargetURL: "http://127.0.0.1:9000"}); err != nil {
		t.Fatalf("SaveRoute failed: %v", err)
	}

	// Close database
	if err := db1.Close(); err != nil {
		t.Fatalf("db1.Close failed: %v", err)
	}

	// 2. Re-open database
	db2, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB db2 failed: %v", err)
	}
	defer func() { _ = db2.Close() }()

	// Verify Module persisted
	m, err := db2.GetModule("persist-mod")
	if err != nil {
		t.Fatalf("GetModule failed after reopen: %v", err)
	}
	if m.Name != "Persist Module" || m.Port != 9000 || m.Status != "running" {
		t.Fatalf("persisted module mismatch: %+v", m)
	}

	// Verify Config persisted
	val, err := db2.GetConfig("boot_count")
	if err != nil {
		t.Fatalf("GetConfig failed after reopen: %v", err)
	}
	if val != "42" {
		t.Fatalf("persisted config mismatch: got %s, expected 42", val)
	}

	// Verify Route persisted
	r, err := db2.GetRoute("/app/persist")
	if err != nil {
		t.Fatalf("GetRoute failed after reopen: %v", err)
	}
	if r.TargetURL != "http://127.0.0.1:9000" {
		t.Fatalf("persisted route mismatch: %+v", r)
	}
}

func TestThreadSafety(t *testing.T) {
	db, tmpDir := createTempDB(t)
	defer cleanupTempDB(db, tmpDir)

	var wg sync.WaitGroup
	workers := 20
	iterations := 50

	for i := 0; i < workers; i++ {
		wg.Add(1)
		workerID := i
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				key := "worker_cfg"
				_ = db.SetConfig(key, "data")
				_, _ = db.GetConfig(key)

				mod := &ModuleManifest{
					ID:     "worker_mod",
					Name:   "Worker",
					Port:   workerID,
					Status: "active",
				}
				_ = db.SaveModule(mod)
				_, _ = db.GetModule("worker_mod")
				_, _ = db.ListModules()

				route := &RouteMeta{
					ModuleID:  "worker_mod",
					Path:      "/worker/route",
					TargetURL: "http://127.0.0.1:8080",
				}
				_ = db.SaveRoute(route)
				_, _ = db.GetRoute("/worker/route")
				_, _ = db.ListRoutes()
			}
		}()
	}

	wg.Wait()
}
