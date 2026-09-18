# Wi-Fi e eduroam na BTV E10 (RTL8189FTV)

Guia operacional do rádio interno da TV Box BTV E10: driver, correção dos
dados falsos do portal e conexão eduroam validada em hardware real.
Atualizado em 2026-09-18.

## 1. Hardware e driver

- Chip: **Realtek RTL8189FTV**, SDIO `024c:f179` (função `mmc0:0001:1`,
  `compatible = realtek,rtl8189fs / realtek,rtl8189ftv`).
- Device tree: o nó SDIO do Wi-Fi (`mmc@ffe03000`) já opera a **25 MHz**
  sem `sd-uhs-sdr50` no `meson-g12a-sei510.dtb` em uso — nenhuma alteração
  de DTB foi necessária (verificar com
  `fdtget <dtb> /soc/mmc@ffe03000 max-frequency` → `25000000`).
- Sem driver in-tree no kernel `6.18.44-ophub`: só o `aic8800_sdio_bsp`
  (chip errado) carregava, sem criar interface.

### Compilação (testada em 2026-09-18)

O branch `rtl8189fs` de `jwrdegoede/rtl8189ES_linux` **não compila no
6.18** (assinaturas cfg80211 mudaram: station ops agora usam
`struct wireless_dev`). Foi usada uma fonte já portada para 6.18
(DKMS `rtl8189fs` 5.7.9, guards `#if LINUX_VERSION_CODE >= 6.18`):

```bash
make -j4 -C /usr/src/rtl8189fs ARCH=arm64 CROSS_COMPILE= \
  KSRC=/lib/modules/$(uname -r)/build CONFIG_PLATFORM_I386_PC=y
install -Dm644 8189fs.ko \
  /lib/modules/$(uname -r)/kernel/drivers/net/wireless/8189fs.ko
depmod -a
```

Persistência via `ForgeHub/hardware/network/` + serviço systemd
(`ExecStart=/sbin/modprobe 8189fs`, `Before=NetworkManager.service`).
O driver cria **duas vifs** (`wlan0` + `wlan1`, modo concorrente); o
NetworkManager usa a `wlan1` e a `wlan0` fica fora do gerenciamento para
evitar disputa do rádio (ver doc da Equipe 7 sobre quedas com duas vifs
no mesmo AP).

## 2. Dados falsos do portal — causa e correção

Sintomas: "Redes nas Proximidades" sempre exibia `OpenWrt` e `eduroam`
com valores fixos, e o status afirmava AP `Forge-E10` ativo inexistente.

Causas encontradas em `ForgeHub/backend/internal/api/api.go`:

1. `deduplicateAndFormatNetworks()` **injetava placeholders** (`OpenWrt`
   `88:c3:97:d5:81:91` e `eduroam` `80:03:84:0f:1c:19`) quando o rádio
   não reportava nada — removidos; lista vazia agora retorna `[]`.
2. Scan preso a `wlan0` + `iwlist` (ausente nas imagens): agora há
   descoberta de interface (`WIFI_IFACE`, interfaces UP, qualquer iface
   wireless) e backend `iw dev <iface> scan` com parser BSS próprio
   (`parseIwScan`), mantidos `iwlist`/`wpa_cli` como fallback.
3. `handleStatus()` com `ap_active/ssid/ip` hardcoded: agora detecta o
   AP de verdade (IP `192.168.4.1` atribuído localmente) e publica o IP
   primário do nó; `handleAP()` ganhou o campo `active`.
4. `hardware/network/apply_client.sh` fora de sincronia com o backend e
   `forge-ap-ctrl` com CRLF (não executava): script aceita `WIFI_IFACE`
   e o AP-ctrl voltou a LF.

## 3. eduroam validado em hardware

Ambiente: APs IFSP (`IFSP-Servidores`, `IFSP-IOT`, `eduroam`,
`80:03:84:0f:1c:19`, WPA2-EAP+EAP-SHA256).

Descobertas:

- Com identidade externa `anonymous@unesp.br`, o TLS terminava no
  RADIUS da UNESP (`/CN=eduroam.unesp.br`, FreeRADIUS 3.2.5) e o
  MSCHAPv2 interno era **rejeitado** (PEAP puro, com realm e TTLS/PAP).
- Com identidade **pura, sem realm** (`AV12350X`, externa vazia), o TLS
  termina no servidor **local** (`/CN=eduroamv4.ifsp.edu.br`), cuja CA
  não está no bundle do sistema — exige o modo **sem validação**
  (campo domínio vazio no portal; equivale ao "não validar" dos guias
  de celular). Com isso: `EAP-SUCCESS`, DHCP `10.129.75.116/24`, ping e
  HTTPS pela `wlan1` OK.
- Perfil NM **`eduroam`** persistido na box (ifname `wlan1`,
  PEAP/MSCHAPv2, autoconnect): a conexão sobrevive ao reboot.

> Sem validação há risco de evil-twin: quando a CA do IFSP estiver
> disponível, cadastrá-la e voltar a validar.

## 4. Build e deploy do forgehub

Frontend: `npm run build` em `ForgeHub/frontend` → copiar
`dist/{index.html,assets/*}` para
`ForgeHub/backend/cmd/forgehub/web_assets/` (o binário embute via
`//go:embed all:web_assets`).

Backend (reproduzível, mesmos flags do build de produção):

```bash
cd ForgeHub/backend
GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" \
  -o /tmp/forgehub ./cmd/forgehub
```

Deploy na box:

```bash
install -m 755 /tmp/forgehub /usr/local/bin/forgehub  # com backup prévio
install -m 755 apply_client.sh forge-ap-ctrl /opt/forgehub/hardware/network/
mkdir -p /etc/systemd/system/forgehub.service.d
printf '[Service]\nEnvironment=WIFI_IFACE=wlan1\n' \
  > /etc/systemd/system/forgehub.service.d/wifi.conf
systemctl daemon-reload && systemctl restart forgehub
curl -s http://127.0.0.1:8080/api/scan    # redes reais
curl -s http://127.0.0.1:8080/api/status  # sem hardcode
```

## 5. Pendências conhecidas

- Instalar a CA do eduroam/IFSP e reativar a validação do servidor.
- Migrar o provisionamento da UI para o NetworkManager (o fluxo atual
  via `wpa_supplicant` cru conflita com a `wlan1` gerenciada e a box
  não tem cliente DHCP para esse caminho) — provisionamento live
  **não** foi testado por esse motivo.
- `TestWifiTLSCertificates` e `TestWifiProvisionLifecycle` falham no
  Windows (paths `/bin/sh`); passam no CI Linux — pré-existente,
  verificado no HEAD.
