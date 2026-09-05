package main

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type Metrics struct {
	Timestamp     float64       `json:"timestamp"`
	CpuPct        float64       `json:"cpu_pct"`
	CpuFreqMhz    int           `json:"cpu_freq_mhz"`
	CpuTemp       float64       `json:"cpu_temp"`
	LoadAvg       []float64     `json:"load_avg"`
	RamUsedMb     int           `json:"ram_used_mb"`
	RamTotalMb    int           `json:"ram_total_mb"`
	RamPct        float64       `json:"ram_pct"`
	RxKbs         float64       `json:"rx_kbs"`
	TxKbs         float64       `json:"tx_kbs"`
	Uptime        int           `json:"uptime"`
	DiskUsedGb    float64       `json:"disk_used_gb"`
	DiskTotalGb   float64       `json:"disk_total_gb"`
	TopProcesses  []ProcessInfo `json:"top_processes"`
}

type ProcessInfo struct {
	Pid  string `json:"pid"`
	Name string `json:"name"`
	Cpu  string `json:"cpu"`
	Mem  string `json:"mem"`
}

var (
	lastMetricsTime float64
	lastIdleTime    float64
	lastTotalTime   float64
	lastRxBytes     int64
	lastTxBytes     int64
)

func getRealtimeMetrics() Metrics {
	now := float64(time.Now().UnixNano()) / 1e9
	dt := now - lastMetricsTime
	if dt < 0.1 && lastMetricsTime > 0 {
		dt = 0.1
	}
	if lastMetricsTime == 0 {
		dt = 1.0
	}
	lastMetricsTime = now

	m := Metrics{Timestamp: now, RamTotalMb: 1980, LoadAvg: []float64{0.1, 0.05, 0.05}}

	// Uptime
	if b, err := os.ReadFile("/proc/uptime"); err == nil {
		if fields := strings.Fields(string(b)); len(fields) > 0 {
			if up, err := strconv.ParseFloat(fields[0], 64); err == nil {
				m.Uptime = int(up)
			}
		}
	} else {
		m.Uptime = int(time.Now().Unix() - 1756500000)
	}

	// CPU Temp
	m.CpuTemp = 42.0
	if b, err := os.ReadFile("/sys/class/thermal/thermal_zone0/temp"); err == nil {
		if temp, err := strconv.Atoi(strings.TrimSpace(string(b))); err == nil {
			m.CpuTemp = float64(temp) / 1000.0
		}
	}

	// MemInfo
	memTotal, memAvail := 1980, 1620
	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				if fields[0] == "MemTotal:" {
					if v, err := strconv.Atoi(fields[1]); err == nil { memTotal = v / 1024 }
				} else if fields[0] == "MemAvailable:" {
					if v, err := strconv.Atoi(fields[1]); err == nil { memAvail = v / 1024 }
				}
			}
		}
	}
	m.RamTotalMb = memTotal
	m.RamUsedMb = memTotal - memAvail
	if m.RamTotalMb > 0 {
		m.RamPct = float64(m.RamUsedMb) / float64(m.RamTotalMb) * 100.0
	}

	// Top
	cmd := exec.Command("ps", "-eo", "pid,comm,%cpu,%mem", "--sort=-%mem")
	if b, err := cmd.Output(); err == nil {
		lines := strings.Split(strings.TrimSpace(string(b)), "\n")
		for i := 1; i < len(lines) && i <= 5; i++ {
			fields := strings.Fields(lines[i])
			if len(fields) >= 4 {
				m.TopProcesses = append(m.TopProcesses, ProcessInfo{Pid: fields[0], Name: fields[1], Cpu: fields[2], Mem: fields[3]})
			}
		}
	}

	return m
}

func getHardwareInfo() map[string]interface{} {
	return map[string]interface{}{
		"device_model": "BTV Express E10 (SEI510)",
		"os_name": "Armbian GNU/Linux",
		"kernel": "Linux 6.18-ophub",
		"cpu_arch": "aarch64 (ARMv8-A)",
		"cpu_soc": "Amlogic S905X2",
		"cpu_cores": 4,
		"dtb": "meson-g12a-btv-e10-enterprise.dtb",
		"boot_used_mb": 170,
		"boot_total_mb": 510,
	}
}
