package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"go.etcd.io/bbolt"
)

var (
	BucketModules = []byte("modules")
	BucketConfig  = []byte("config")
	BucketCache   = []byte("store_cache")
	BucketProxy   = []byte("proxy_routes")

	ErrNotFound     = errors.New("record not found")
	ErrNilRecord    = errors.New("nil record")
	ErrEmptyKey     = errors.New("empty key/id")
	ErrDBClosed     = errors.New("database is closed")
)

type ModuleManifest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Type        string `json:"type"` // "compose" or "systemd"
	Category    string `json:"category"`
	Icon        string `json:"icon"`
	Description string `json:"description"`
	Port        int    `json:"port"`
	ProxyPath   string `json:"proxy_path"`
	MinRAMMB    int    `json:"min_ram_mb"`
	MinDiskMB   int    `json:"min_disk_mb"`
	Tier        string `json:"tier"`
	Author      string `json:"author"`
	Status      string `json:"status"` // "running", "stopped", "error", "installing"
}

// ModuleRecord type alias for backward compatibility
type ModuleRecord = ModuleManifest

type RouteMeta struct {
	ModuleID    string `json:"module_id"`
	Path        string `json:"path"`
	TargetURL   string `json:"target_url"`
	StripPrefix bool   `json:"strip_prefix"`
}

// RouteRecord type alias for backward compatibility
type RouteRecord = RouteMeta

type DB struct {
	db *bbolt.DB
	mu sync.RWMutex
}

func InitDB(path string) (*DB, error) {
	db, err := bbolt.Open(path, 0600, nil)
	if err != nil {
		return nil, fmt.Errorf("open bbolt: %w", err)
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		buckets := [][]byte{BucketModules, BucketConfig, BucketCache, BucketProxy}
		for _, b := range buckets {
			if _, err := tx.CreateBucketIfNotExists(b); err != nil {
				return fmt.Errorf("create bucket %s: %w", string(b), err)
			}
		}
		return nil
	})
	if err != nil {
		_ = db.Close()
		return nil, err
	}

	return &DB{db: db}, nil
}

func (s *DB) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.db == nil {
		return nil
	}
	err := s.db.Close()
	s.db = nil
	return err
}

// ---------------- Modules CRUD ----------------

func (s *DB) SaveModule(m *ModuleManifest) error {
	if m == nil {
		return ErrNilRecord
	}
	if m.ID == "" {
		return ErrEmptyKey
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return ErrDBClosed
	}

	data, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("marshal module: %w", err)
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketModules)
		return b.Put([]byte(m.ID), data)
	})
}

func (s *DB) GetModule(id string) (*ModuleManifest, error) {
	if id == "" {
		return nil, ErrEmptyKey
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.db == nil {
		return nil, ErrDBClosed
	}

	var m ModuleManifest
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketModules)
		val := b.Get([]byte(id))
		if val == nil {
			return ErrNotFound
		}
		return json.Unmarshal(val, &m)
	})
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *DB) DeleteModule(id string) error {
	if id == "" {
		return ErrEmptyKey
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return ErrDBClosed
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketModules)
		if b.Get([]byte(id)) == nil {
			return ErrNotFound
		}
		return b.Delete([]byte(id))
	})
}

func (s *DB) ListModules() ([]*ModuleManifest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.db == nil {
		return nil, ErrDBClosed
	}

	var list []*ModuleManifest
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketModules)
		return b.ForEach(func(k, v []byte) error {
			var m ModuleManifest
			if err := json.Unmarshal(v, &m); err == nil {
				list = append(list, &m)
			}
			return nil
		})
	})
	return list, err
}

// ---------------- Config CRUD ----------------

func (s *DB) SetConfig(key, val string) error {
	if key == "" {
		return ErrEmptyKey
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return ErrDBClosed
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketConfig)
		return b.Put([]byte(key), []byte(val))
	})
}

func (s *DB) GetConfig(key string) (string, error) {
	if key == "" {
		return "", ErrEmptyKey
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.db == nil {
		return "", ErrDBClosed
	}

	var res string
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketConfig)
		val := b.Get([]byte(key))
		if val == nil {
			return ErrNotFound
		}
		res = string(val)
		return nil
	})
	return res, err
}

// ---------------- Proxy Routes CRUD ----------------

func (s *DB) SaveRoute(r *RouteMeta) error {
	if r == nil {
		return ErrNilRecord
	}
	if r.Path == "" {
		return ErrEmptyKey
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return ErrDBClosed
	}

	data, err := json.Marshal(r)
	if err != nil {
		return fmt.Errorf("marshal route: %w", err)
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketProxy)
		return b.Put([]byte(r.Path), data)
	})
}

func (s *DB) GetRoute(path string) (*RouteMeta, error) {
	if path == "" {
		return nil, ErrEmptyKey
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.db == nil {
		return nil, ErrDBClosed
	}

	var r RouteMeta
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketProxy)
		val := b.Get([]byte(path))
		if val == nil {
			return ErrNotFound
		}
		return json.Unmarshal(val, &r)
	})
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *DB) DeleteRoute(path string) error {
	if path == "" {
		return ErrEmptyKey
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return ErrDBClosed
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketProxy)
		if b.Get([]byte(path)) == nil {
			return ErrNotFound
		}
		return b.Delete([]byte(path))
	})
}

func (s *DB) DeleteRouteByModule(moduleID string) error {
	if moduleID == "" {
		return ErrEmptyKey
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil {
		return ErrDBClosed
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketProxy)
		var keysToDelete [][]byte
		_ = b.ForEach(func(k, v []byte) error {
			var r RouteMeta
			if err := json.Unmarshal(v, &r); err == nil {
				if r.ModuleID == moduleID {
					keysToDelete = append(keysToDelete, append([]byte(nil), k...))
				}
			}
			return nil
		})
		for _, k := range keysToDelete {
			if err := b.Delete(k); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *DB) ListRoutes() ([]*RouteMeta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.db == nil {
		return nil, ErrDBClosed
	}

	var list []*RouteMeta
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketProxy)
		return b.ForEach(func(k, v []byte) error {
			var r RouteMeta
			if err := json.Unmarshal(v, &r); err == nil {
				list = append(list, &r)
			}
			return nil
		})
	})
	return list, err
}
