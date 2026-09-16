package api

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"path/filepath"
	"strings"
)

type wifiProvision struct {
	SSID              string `json:"ssid"`
	Type              string `json:"type"`
	Password          string `json:"password"`
	Identity          string `json:"identity"`
	Method            string `json:"method"`
	Phase2            string `json:"phase2"`
	AnonymousIdentity string `json:"anonymous_identity"`
	Domain            string `json:"domain"`
	CACert            string `json:"ca_cert"`
	ClientCert        string `json:"client_cert"`
	PrivateKey        string `json:"private_key"`
}

func wifiQuote(s string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
}

func validCertificate(value string) bool {
	count := 0
	for strings.TrimSpace(value) != "" {
		block, rest := pem.Decode([]byte(value))
		if block == nil || block.Type != "CERTIFICATE" {
			return false
		}
		if _, err := x509.ParseCertificate(block.Bytes); err != nil {
			return false
		}
		count++
		value = string(rest)
	}
	return count > 0
}

// Validate before touching the radio; never interpolate untrusted directives.
func buildWifiConfig(p wifiProvision, profileDir string) (string, error) {
	fail := func(s string) (string, error) { return "", fmt.Errorf("%s", s) }
	if len(p.SSID) == 0 || len(p.SSID) > 32 {
		return fail("SSID deve ter de 1 a 32 bytes")
	}
	for _, value := range []string{p.SSID, p.Password, p.Identity, p.AnonymousIdentity, p.Domain} {
		for _, c := range value {
			if c < 32 || c == 127 {
				return fail("Credencial contém caractere de controle inválido")
			}
		}
	}
	lines := []string{"ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev", "update_config=0", "network={", "    ssid=" + hex.EncodeToString([]byte(p.SSID)), "    scan_ssid=1"}
	add := func(k, v string) { lines = append(lines, "    "+k+"="+v) }
	switch p.Type {
	case "open":
		add("key_mgmt", "NONE")
	case "owe":
		add("key_mgmt", "OWE")
		add("ieee80211w", "2")
	case "psk":
		if len(p.Password) == 64 {
			if _, err := hex.DecodeString(p.Password); err != nil {
				return fail("PSK de 64 caracteres deve ser hexadecimal")
			}
			add("psk", p.Password)
		} else {
			if len(p.Password) < 8 || len(p.Password) > 63 {
				return fail("Senha WPA/WPA2 deve ter de 8 a 63 bytes")
			}
			add("psk", wifiQuote(p.Password))
		}
		add("key_mgmt", "WPA-PSK")
	case "sae":
		if len(p.Password) == 0 || len(p.Password) > 63 {
			return fail("Senha WPA3 deve ter de 1 a 63 bytes")
		}
		add("key_mgmt", "SAE")
		add("sae_password", wifiQuote(p.Password))
		add("ieee80211w", "2")
	case "eap":
		if strings.TrimSpace(p.Identity) == "" {
			return fail("Identidade EAP obrigatória")
		}
		switch p.Method {
		case "PEAP", "TTLS", "PWD", "TLS":
		default:
			return fail("Método EAP inválido")
		}
		add("key_mgmt", "WPA-EAP")
		add("eap", p.Method)
		add("identity", wifiQuote(p.Identity))
		if p.Method == "TLS" {
			if !validCertificate(p.ClientCert) {
				return fail("Certificado do cliente PEM inválido")
			}
			if _, err := tls.X509KeyPair([]byte(p.ClientCert), []byte(p.PrivateKey)); err != nil {
				return fail("Chave PEM sem senha deve corresponder ao certificado do cliente")
			}
			add("client_cert", wifiQuote(filepath.Join(profileDir, "client.pem")))
			add("private_key", wifiQuote(filepath.Join(profileDir, "client.key")))
		} else {
			if p.Password == "" {
				return fail("Senha EAP obrigatória")
			}
			add("password", wifiQuote(p.Password))
		}
		if p.Method == "PEAP" || p.Method == "TTLS" {
			if p.Phase2 != "MSCHAPV2" && p.Phase2 != "GTC" && !(p.Method == "TTLS" && p.Phase2 == "PAP") {
				return fail("Autenticação interna inválida para o método EAP")
			}
			phase := "auth=" + p.Phase2
			if p.Method == "TTLS" && p.Phase2 == "GTC" {
				phase = "autheap=GTC"
			}
			add("phase2", wifiQuote(phase))
			if p.AnonymousIdentity != "" {
				add("anonymous_identity", wifiQuote(p.AnonymousIdentity))
			}
		}
		if p.Method != "PWD" {
			domain := strings.TrimPrefix(p.Domain, ".")
			if domain == "" || strings.ContainsAny(domain, " /\\\";:") {
				return fail("Informe o domínio do servidor EAP fornecido pela instituição")
			}
			add("domain_suffix_match", wifiQuote(domain))
			if p.CACert != "" {
				if !validCertificate(p.CACert) {
					return fail("Certificado CA PEM inválido")
				}
				add("ca_cert", wifiQuote(filepath.Join(profileDir, "ca.pem")))
			} else {
				add("ca_cert", `"/etc/ssl/certs/ca-certificates.crt"`)
			}
		}
	default:
		return fail("Tipo de segurança inválido")
	}
	return strings.Join(append(lines, "}"), "\n") + "\n", nil
}
