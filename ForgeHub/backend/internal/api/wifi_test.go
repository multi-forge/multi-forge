package api

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWifiConfigModes(t *testing.T) {
	cases := []struct {
		name string
		p    wifiProvision
		want string
	}{
		{"open", wifiProvision{SSID: "Guest", Type: "open"}, "key_mgmt=NONE"},
		{"psk", wifiProvision{SSID: "Home", Type: "psk", Password: "password123"}, "key_mgmt=WPA-PSK"},
		{"hex", wifiProvision{SSID: "Home", Type: "psk", Password: strings.Repeat("ab", 32)}, "psk=" + strings.Repeat("ab", 32)},
		{"sae", wifiProvision{SSID: "Home", Type: "sae", Password: "secret"}, "ieee80211w=2"},
		{"owe", wifiProvision{SSID: "Guest", Type: "owe"}, "key_mgmt=OWE"},
		{"peap", wifiProvision{SSID: "Campus", Type: "eap", Method: "PEAP", Phase2: "MSCHAPV2", Identity: "student", Password: "secret", Domain: "example.edu"}, `phase2="auth=MSCHAPV2"`},
		{"ttls", wifiProvision{SSID: "Campus", Type: "eap", Method: "TTLS", Phase2: "PAP", Identity: "student", Password: "secret", Domain: "example.edu"}, `phase2="auth=PAP"`},
		{"pwd", wifiProvision{SSID: "Campus", Type: "eap", Method: "PWD", Identity: "student", Password: "secret"}, "eap=PWD"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			conf, err := buildWifiConfig(tc.p, "/private/profile")
			if err != nil || !strings.Contains(conf, tc.want) {
				t.Fatalf("unexpected configuration: %v", err)
			}
			if tc.p.Type == "eap" && tc.p.Method != "PWD" {
				if !strings.Contains(conf, `domain_suffix_match="example.edu"`) || !strings.Contains(conf, "ca-certificates.crt") {
					t.Fatal("missing server verification")
				}
			}
		})
	}
}

func TestWifiRejectsInvalidProfiles(t *testing.T) {
	cases := []wifiProvision{
		{SSID: "Home", Type: "unknown"}, {SSID: strings.Repeat("é", 17), Type: "open"},
		{SSID: "Home\nnetwork={", Type: "open"}, {SSID: "Home", Type: "psk", Password: "short"},
		{SSID: "Home", Type: "psk", Password: strings.Repeat("z", 64)},
		{SSID: "Home", Type: "psk", Password: "secret12\nkey_mgmt=NONE"},
		{SSID: "Campus", Type: "eap", Method: "PEAP", Phase2: "PAP", Identity: "student", Password: "secret", Domain: "example.edu"},
		{SSID: "Campus", Type: "eap", Method: "PEAP", Phase2: "MSCHAPV2", Identity: "student", Password: "secret", Domain: "example.edu", CACert: "bad cert"},
		{SSID: "Campus", Type: "eap", Method: "TLS", Identity: "student", Domain: "example.edu"},
	}
	for i, p := range cases {
		if _, err := buildWifiConfig(p, "/profile"); err == nil {
			t.Errorf("case %d accepted", i)
		}
	}
	conf, err := buildWifiConfig(wifiProvision{SSID: `Home"\`, Type: "psk", Password: `pass"\word`}, "/profile")
	if err != nil || !strings.Contains(conf, `psk="pass\"\\word"`) {
		t.Fatal("quoted credentials not escaped")
	}
}

func TestWifiNoServerValidation(t *testing.T) {
	// eduroam roots whose CA is not in the system bundle (e.g. local
	// federation CAs): empty domain opts out of server validation,
	// mirroring the "do not validate" choice of phone guides.
	conf, err := buildWifiConfig(wifiProvision{SSID: "eduroam", Type: "eap", Method: "PEAP", Phase2: "MSCHAPV2", Identity: "AV12350X", Password: "secret123"}, "/profile")
	if err != nil {
		t.Fatalf("bare eduroam profile rejected: %v", err)
	}
	if strings.Contains(conf, "domain_suffix_match") || strings.Contains(conf, "ca_cert") {
		t.Fatalf("no-validation profile must not constrain the server: %s", conf)
	}
	if !strings.Contains(conf, `identity="AV12350X"`) || !strings.Contains(conf, `phase2="auth=MSCHAPV2"`) {
		t.Fatalf("identity/phase2 missing: %s", conf)
	}
}

func TestWifiTLSCertificates(t *testing.T) {
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "student"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	keyDER, _ := x509.MarshalECPrivateKey(key)
	priv := string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))
	p := wifiProvision{SSID: "Campus", Type: "eap", Method: "TLS", Identity: "student", Domain: "example.edu", CACert: cert, ClientCert: cert, PrivateKey: priv}
	conf, err := buildWifiConfig(p, "/private/profile")
	if err != nil || !strings.Contains(conf, `private_key="/private/profile/client.key"`) || strings.Contains(conf, "password=") {
		t.Fatalf("TLS profile invalid: %v", err)
	}
	p.PrivateKey = "invalid"
	if _, err := buildWifiConfig(p, "/profile"); err == nil {
		t.Fatal("invalid key accepted")
	}
}

func TestWifiProvisionLifecycle(t *testing.T) {
	oldScript, oldRoot := wifiApplyScript, wifiProfileRoot
	defer func() { wifiApplyScript = oldScript; wifiProfileRoot = oldRoot }()
	wifiProfileRoot = t.TempDir()
	wifiApplyScript = filepath.Join(t.TempDir(), "apply")
	if err := os.WriteFile(wifiApplyScript, []byte("#!/bin/sh\nsleep 0.1\nprintf '10.2.3.4\\n'\n"), 0700); err != nil {
		t.Fatal(err)
	}
	provMu.Lock()
	provisioningActive = false
	provMu.Unlock()
	request := func(payload string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		handleProvision(w, httptest.NewRequest("POST", "/api/provision", strings.NewReader(payload)))
		return w
	}
	payload := `{"ssid":"Home","type":"psk","password":"secret123"}`
	res := request(payload)
	if res.Code != 200 || strings.Contains(res.Body.String(), "secret123") {
		t.Fatalf("response %d %s", res.Code, res.Body.String())
	}
	if conflict := request(`{"ssid":"Campus","type":"eap","method":"PWD","identity":"user","password":"secret"}`); conflict.Code != 409 {
		t.Fatalf("EAP bypassed lock: %d", conflict.Code)
	}
	wait := func() {
		t.Helper()
		for i := 0; i < 100; i++ {
			provMu.Lock()
			active := provisioningActive
			provMu.Unlock()
			if !active {
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		t.Fatal("provisioning stuck")
	}
	wait()
	provMu.Lock()
	connected, ip := clientConnectedState, clientIPState
	provMu.Unlock()
	if !connected || ip != "10.2.3.4" {
		t.Fatal("script result not used")
	}
	entries, _ := os.ReadDir(wifiProfileRoot)
	if len(entries) != 1 {
		t.Fatal("profile not retained")
	}
	st, _ := os.Stat(filepath.Join(wifiProfileRoot, entries[0].Name(), "client.conf"))
	if st.Mode().Perm() != 0600 {
		t.Fatal("credential file permissions")
	}
	os.WriteFile(wifiApplyScript, []byte("#!/bin/sh\nexit 1\n"), 0700)
	if request(payload).Code != 200 {
		t.Fatal("failed to enqueue")
	}
	wait()
	provMu.Lock()
	connected = clientConnectedState
	failure := provisioningError
	provMu.Unlock()
	if connected || failure == "" {
		t.Fatal("failed command reported success")
	}
	entries, _ = os.ReadDir(wifiProfileRoot)
	if len(entries) != 1 {
		t.Fatal("failed profile leaked")
	}
	os.Remove(wifiApplyScript)
	if request(payload).Code != 503 {
		t.Fatal("missing script accepted")
	}
	if request(`{"ssid":"Home","type":"psk","password":123}`).Code != 400 {
		t.Fatal("non-string password accepted")
	}
	status := httptest.NewRecorder()
	handleStatus(status, httptest.NewRequest("GET", "/api/status", nil))
	var data map[string]interface{}
	json.Unmarshal(status.Body.Bytes(), &data)
	if strings.Contains(status.Body.String(), "secret123") {
		t.Fatal("status leaked credentials")
	}
}
