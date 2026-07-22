#!/usr/bin/env python3
"""
ForgeOS Onboarding Kiosk Display Generator
Generates a minimalist, high-contrast dark theme screen with 2 QR codes:
1. Wi-Fi AP Auto-Connect QR Code (WIFI:S:ForgeOS-Setup-btve10;T:WPA;P:forgeos123;;)
2. Captive Portal URL QR Code (http://192.168.4.1)

Renders via Linux Framebuffer (fbi / /dev/fb0) for HDMI displays.
"""
import os
import sys
import subprocess
from pathlib import Path

def generate_display_image():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("[FORGE-DISPLAY WARNING] Pillow PIL not installed.")
        return False

    # 1. Generate PNGs using qrencode
    run_cmd = lambda cmd: subprocess.run(cmd, shell=True, capture_output=True)
    
    wifi_qr_data = "WIFI:S:ForgeOS-Setup-btve10;T:WPA;P:forgeos123;;"
    url_qr_data = "http://192.168.4.1"

    run_cmd(f'qrencode -s 10 -o /tmp/qr_wifi.png "{wifi_qr_data}"')
    run_cmd(f'qrencode -s 10 -o /tmp/qr_url.png "{url_qr_data}"')

    if not Path('/tmp/qr_wifi.png').exists() or not Path('/tmp/qr_url.png').exists():
        print("[FORGE-DISPLAY ERROR] Failed to generate QR PNG files.")
        return False

    # 2. Canvas dimensions (1920x1080 Full HD minimalist dark theme)
    W, H = 1920, 1080
    canvas = Image.new('RGB', (W, H), color='#0d1117')
    draw = ImageDraw.Draw(canvas)

    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except Exception:
        font_title = font_sub = font_body = ImageFont.load_default()

    # Draw Header
    draw.text((W // 2, 80), "ForgeOS — Provisioning & Setup Kiosk", fill="#f0f6fc", font=font_title, anchor="mm")
    draw.text((W // 2, 140), "Dispositivo: BTV E10 (Amlogic S905X2) | Distro: ForgeOS v1.2", fill="#8b949e", font=font_body, anchor="mm")

    # Load QR Images
    img_wifi = Image.open('/tmp/qr_wifi.png').convert('RGB')
    img_url = Image.open('/tmp/qr_url.png').convert('RGB')

    # Card 1: Wi-Fi AP QR
    c1_x, c1_y = 360, 240
    draw.rectangle([c1_x, c1_y, c1_x + 500, c1_y + 650], fill="#161b22", outline="#30363d", width=2)
    draw.text((c1_x + 250, c1_y + 40), "1. Conectar na Wi-Fi", fill="#58a6ff", font=font_sub, anchor="mm")
    canvas.paste(img_wifi, (c1_x + 100, c1_y + 90))
    draw.text((c1_x + 250, c1_y + 440), "SSID: ForgeOS-Setup-btve10", fill="#f0f6fc", font=font_body, anchor="mm")
    draw.text((c1_x + 250, c1_y + 480), "Senha: forgeos123", fill="#8b949e", font=font_body, anchor="mm")
    draw.text((c1_x + 250, c1_y + 540), "Escaneie para conectar automático", fill="#238636", font=font_body, anchor="mm")

    # Card 2: Captive Portal URL QR
    c2_x, c2_y = 1060, 240
    draw.rectangle([c2_x, c2_y, c2_x + 500, c2_y + 650], fill="#161b22", outline="#30363d", width=2)
    draw.text((c2_x + 250, c2_y + 40), "2. Abrir Portal Captivo", fill="#58a6ff", font=font_sub, anchor="mm")
    canvas.paste(img_url, (c2_x + 100, c2_y + 90))
    draw.text((c2_x + 250, c2_y + 440), "URL: http://192.168.4.1", fill="#f0f6fc", font=font_body, anchor="mm")
    draw.text((c2_x + 250, c2_y + 480), "Portal de Configuração Web", fill="#8b949e", font=font_body, anchor="mm")
    draw.text((c2_x + 250, c2_y + 540), "Escaneie para abrir no navegador", fill="#238636", font=font_body, anchor="mm")

    # Footer
    draw.text((W // 2, 980), "Aguardando provisionamento via navegador ou aplicativo...", fill="#6e7681", font=font_body, anchor="mm")

    output_path = '/tmp/forge_setup_display.png'
    canvas.save(output_path)
    print(f"[FORGE-DISPLAY SUCCESS] Saved setup kiosk screen to {output_path}")
    return True

def render_to_framebuffer():
    if generate_display_image():
        # Render image to DRM/KMS framebuffer using fbi
        print("[FORGE-DISPLAY] Outputting display image to /dev/fb0 framebuffer...")
        subprocess.run('fbi -d /dev/fb0 -T 1 --noverbose -a /tmp/forge_setup_display.png 2>/dev/null', shell=True)

if __name__ == '__main__':
    render_to_framebuffer()
