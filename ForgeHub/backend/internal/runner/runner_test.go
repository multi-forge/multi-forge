package runner

import (
	"context"
	"errors"
	"os/exec"
	"path/filepath"
	"testing"

	"forgehub/internal/store"
)

func newTestRunner(t *testing.T) (*HybridRunner, *store.DB) {
	t.Helper()
	db, err := store.InitDB(filepath.Join(t.TempDir(), "forgehub.db"))
	if err != nil {
		t.Fatalf("init test database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	runner := NewHybridRunner(t.TempDir(), db)
	err = runner.RegisterManifest(store.ModuleRecord{
		ID: "mina-ia", Type: "systemd", MinRAMMB: 1, Status: "stopped",
	})
	if err != nil {
		t.Fatalf("register module: %v", err)
	}
	return runner, db
}

func withCommand(t *testing.T, command func(context.Context, string, ...string) *exec.Cmd) {
	t.Helper()
	previous := execCommandContext
	execCommandContext = command
	t.Cleanup(func() { execCommandContext = previous })
}

func TestStartPersistsRunningOnlyAfterSystemdVerification(t *testing.T) {
	runner, db := newTestRunner(t)
	withCommand(t, func(ctx context.Context, _ string, _ ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "sh", "-c", "exit 0")
	})

	module, _, err := runner.Start(context.Background(), "mina-ia", 1024)
	if err != nil {
		t.Fatalf("start module: %v", err)
	}
	if module.Status != "running" {
		t.Fatalf("returned status = %q, want running", module.Status)
	}
	persisted, err := db.GetModule("mina-ia")
	if err != nil {
		t.Fatalf("read persisted module: %v", err)
	}
	if persisted.Status != "running" {
		t.Fatalf("persisted status = %q, want running", persisted.Status)
	}
}

func TestStartDoesNotClaimSuccessWhenSystemdFails(t *testing.T) {
	runner, db := newTestRunner(t)
	withCommand(t, func(ctx context.Context, _ string, _ ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "sh", "-c", "exit 1")
	})

	module, _, err := runner.Start(context.Background(), "mina-ia", 1024)
	if !errors.Is(err, ErrModuleStart) {
		t.Fatalf("start error = %v, want ErrModuleStart", err)
	}
	if module.Status != "stopped" {
		t.Fatalf("returned status = %q, want stopped", module.Status)
	}
	persisted, err := db.GetModule("mina-ia")
	if err != nil {
		t.Fatalf("read persisted module: %v", err)
	}
	if persisted.Status != "stopped" {
		t.Fatalf("persisted status = %q, want stopped", persisted.Status)
	}
}

func TestStartRejectsUnknownModuleType(t *testing.T) {
	db, err := store.InitDB(filepath.Join(t.TempDir(), "forgehub.db"))
	if err != nil {
		t.Fatalf("init test database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	runner := NewHybridRunner(t.TempDir(), db)
	if err := runner.RegisterManifest(store.ModuleRecord{ID: "unknown", Type: "custom", Status: "stopped"}); err != nil {
		t.Fatalf("register module: %v", err)
	}

	_, _, err = runner.Start(context.Background(), "unknown", 1024)
	if !errors.Is(err, ErrUnsupportedType) {
		t.Fatalf("start error = %v, want ErrUnsupportedType", err)
	}
}
