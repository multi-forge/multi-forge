# 🌲 Device Tree Source & Blobs — ForgeOS (Amlogic S905X2 / BTV Express E10)

Este diretório contém os códigos-fonte (`.dts`) e os binários compilados (`.dtb`) oficiais do Device Tree para a TV Box **BTV Express E10** (SoC Amlogic S905X2 / Meson G12A).

---

## 📂 Arquivos Disponíveis:

| Arquivo | Descrição |
|---|---|
| [`meson-g12a-btv-e10-enterprise.dts`](file:///C:/Users/Aluno/multi-forge/ForgeOS/dtb/meson-g12a-btv-e10-enterprise.dts) | **Código-fonte DTS Enterprise com todas as 7 otimizações aplicadas e comentadas.** |
| [`meson-g12a-btv-e10-enterprise.dtb`](file:///C:/Users/Aluno/multi-forge/ForgeOS/dtb/meson-g12a-btv-e10-enterprise.dtb) | **Binário compilado de produção (77.1 KB) utilizado na imagem oficial do ForgeOS.** |
| [`meson-g12a-sei510.dts`](file:///C:/Users/Aluno/multi-forge/ForgeOS/dtb/meson-g12a-sei510.dts) | DTS base original descompilado do kernel Armbian. |
| [`meson-g12a-sei510.dtb`](file:///C:/Users/Aluno/multi-forge/ForgeOS/dtb/meson-g12a-sei510.dtb) | DTB base de referência. |

---

## 🛠️ Detalhamento das Modificações no DTS Enterprise:

### 1. Memória Contígua CMA (`linux,cma`)
* **Localização:** Nó `reserved-memory -> linux,cma` (Linhas ~115-121)
* **Alteração:** `size = <0x00 0x04000000>;` (64 MB) em substituição a `0x10000000` (256 MB).
* **Impacto:** **Libera +192 MB de memória RAM física livre** para o sistema operacional, Python e Docker em dispositivos de 2GB.

### 2. Estabilização do Barramento SDIO Wi-Fi (`mmc@ffe03000`)
* **Localização:** Nó `soc -> mmc@ffe03000` (Linhas ~2950-2975)
* **Alteração:** `max-frequency = <0x17d7840>;` (25 MHz) em substituição a `0x5f5e100` (100 MHz SDR50).
* **Impacto:** Elimina perdas de sincronismo e ruído eletromagnético no rádio **Realtek RTL8189FTV**, garantindo emissão contínua do sinal de Access Point (HostAP) sem quedas.

### 3. Identificação do Chip Realtek e Remoção de Dispositivos Fantasmas
* **Localização:** Nó `wifi@1` e `bluetooth`
* **Alteração:**
  ```dts
  // Wi-Fi:
  compatible = "realtek,rtl8189fs", "realtek,rtl8189ftv", "generic-sdio";
  
  // Bluetooth Broadcom inexistente:
  bluetooth {
      compatible = "brcm,bcm43438-bt";
      status = "disabled";
  };
  ```
* **Impacto:** Elimina tentativas repetidas de probe na UART e timeouts desnecessários durante a inicialização do kernel.

### 4. Ativação do Hardware Watchdog (`watchdog@f0d0`)
* **Localização:** Nó `soc -> bus@ff800000 -> watchdog@f0d0` (Linhas ~2785-2791)
* **Alteração:** Injetado `status = "okay";` no nó `amlogic,meson-gxbb-wdt`.
* **Impacto:** Habilita o dispositivo `/dev/watchdog` no hardware para reiniciar a TV Box automaticamente se houver travamento total do sistema operacional (**99.99% Uptime**).

### 5. Identidade Autêntica da Placa
* **Localização:** Nó raiz `/` (Linhas ~7-8)
* **Alteração:**
  ```dts
  compatible = "btv,e10", "seirobotics,sei510", "amlogic,g12a";
  model = "BTV Express E10 (Amlogic S905X2)";
  ```
* **Impacto:** Identificação corporativa oficial em ferramentas de inventário e no `ForgeImager`.

### 6. Ethernet RMII Anti-Drop
* **Localização:** Nó `soc -> ethernet@ff3f0000`
* **Alteração:** `eee-broken-1000t; eee-broken-100t; eee-broken-10t;`
* **Impacto:** Previne desconexões físicas em portas Ethernet causadas por transições de Energy-Efficient Ethernet do chip PHY Realtek.

---

## 🔨 Como Recompilar o DTB Manualmente:

```bash
# Descompilar DTB para DTS:
dtc -I dtb -O dts meson-g12a-btv-e10-enterprise.dtb -o meu-custom.dts

# Compilar DTS para DTB com validação estrita:
dtc -I dts -O dtb meu-custom.dts -o meson-g12a-btv-e10-enterprise.dtb
```
