#!/usr/bin/env python3
"""MultiForge IoT Telemetry Engine — UNESP Sorocaba."""
import time
import json
import random
import psutil

def read_sensors():
    # Emulates environmental telemetry from Sorocaba ICTS Greenhouses / Labs
    return {
        "campus": "UNESP Sorocaba (ICTS)",
        "lab": "Laboratório de Controle e Automação (ECA)",
        "temperature_celsius": round(23.5 + random.uniform(-1.5, 2.0), 2),
        "humidity_percent": round(55.0 + random.uniform(-4.0, 5.0), 2),
        "co2_ppm": int(420 + random.uniform(10, 60)),
        "cpu_usage_percent": psutil.cpu_percent(),
        "ram_usage_mb": round(psutil.virtual_memory().used / (1024 * 1024), 1),
        "timestamp": int(time.time())
    }

def main():
    print("[IoT-Telemetry] Iniciando hub de telemetria UNESP Sorocaba...")
    while True:
        data = read_sensors()
        print(f"[Telemetria] Temp: {data['temperature_celsius']}°C | Umidade: {data['humidity_percent']}% | CO2: {data['co2_ppm']} ppm | RAM: {data['ram_usage_mb']} MB")
        time.sleep(10)

if __name__ == "__main__":
    main()
