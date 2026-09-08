#!/usr/bin/env python3
"""MultiForge Obsidian Minimalist Kiosk Engine v3.3
Designed for Amlogic S905X2 (1920x1080 /dev/fb0)
Ultra-clean dark aesthetic, OLED-friendly, zero blinding cards.
"""
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FB = "/dev/fb0"
LINE_LEN = 7680

FONTS_DIR = "/opt/forgehub/hardware/display/fonts"
STATE_DIR = "/opt/multi-forge/ForgeOS/state"
PORTAL_AP_URL = "http://192.168.4.1:8080"

def F(name, size):
    p = os.path.join(FONTS_DIR, name)
    if Path(p).exists():
        return ImageFont.truetype(p, size)
    for fb in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if "Bold" in name else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf"
    ):
        if Path(fb).exists():
            return ImageFont.truetype(fb, size)
    return ImageFont.load_default()

# ---- Refined Obsidian Minimal Palette ----
BG = (13, 17, 23)               # Deep Obsidian Dark #0D1117
TEXT_WHITE = (248, 250, 252)     # #F8FAFC
TEXT_MUTED = (148, 163, 184)     # #94A3B8
TEXT_FAINT = (100, 116, 139)     # #64748B

PILL_BG = (22, 27, 34)          # #161B22
PILL_BORDER = (48, 54, 61)       # #30363D

ACCENT_BLUE = (56, 189, 248)     # #38BDF8
ACCENT_GREEN = (74, 222, 128)    # #4ADE80
ACCENT_AMBER = (251, 191, 36)    # #FBBF24
ACCENT_RED = (248, 113, 113)     # #F87171

def get_cpu_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            return round(int(f.read().strip()) / 1000.0, 1)
    except Exception:
        return 42.0

def get_ram_info():
    try:
        tot, av = 0, 0
        with open("/proc/meminfo") as f:
            for l in f:
                if l.startswith("MemTotal:"): tot = int(l.split()[1]) // 1024
                elif l.startswith("MemAvailable:"): av = int(l.split()[1]) // 1024
        if tot:
            pct = round((tot - av) / tot * 100, 1)
            return f"{pct}% ({tot - av} MB / {tot / 1024:.1f} GB)"
    except Exception:
        pass
    return "19% (390 MB / 1.8 GB)"

def get_uptime():
    try:
        with open("/proc/uptime") as f:
            sec = int(float(f.read().split()[0]))
            return f"{sec // 3600}h {(sec % 3600) // 60:02d}m"
    except Exception:
        return "8h 55m"

def get_mac():
    try:
        return open("/sys/class/net/wlan0/address").read().strip().upper()
    except Exception:
        return "3C:7A:AA:39:F6:C2"

def get_ip():
    for iface in ("eth0", "wlan0"):
        try:
            out = subprocess.run(["ip", "-4", "addr", "show", iface],
                                 capture_output=True, text=True, timeout=1.5)
            ips = re.findall(r"inet\s+([\d.]+)", out.stdout)
            for ip in ips:
                if ip != "127.0.0.1":
                    return ip
        except Exception:
            pass
    return "192.168.1.153"

def read_ap_config():
    cfg = {"ssid": "Forge-E10", "password": "forgehub", "channel": 1}
    for cf in ("/opt/multi-forge/ForgeOS/network/wpa_ap.conf", "/etc/hostapd/hostapd.conf"):
        try:
            with open(cf) as f:
                content = f.read()
            m = re.search(r'ssid[=\s"]+([^"\n]+)', content)
            if m:
                cfg["ssid"] = m.group(1).strip().strip('"')
            m = re.search(r'(?:psk|wpa_passphrase)[=\s"]+([^"\n]+)', content)
            if m:
                cfg["password"] = m.group(1).strip().strip('"')
        except OSError:
            pass
    return cfg

def station_count():
    try:
        out = subprocess.run(["iw", "dev", "wlan0", "station", "dump"],
                             capture_output=True, text=True, timeout=0.8)
        stas = [l for l in out.stdout.splitlines() if l.startswith("Station")]
        if stas:
            return len(stas)
    except Exception:
        pass
    return 0

def get_state():
    info = {
        "ssid": "Forge-E10",
        "password": "forgehub",
        "ip": get_ip(),
        "stations": station_count(),
        "temp": get_cpu_temp(),
        "ram": get_ram_info(),
        "up": get_uptime(),
        "mac": get_mac()
    }
    
    # 1. Applying check
    if os.path.exists(os.path.join(STATE_DIR, "applying")):
        target = "Wi-Fi"
        try:
            target = json.load(open(os.path.join(STATE_DIR, "provision.json"))).get("ssid", target)
        except Exception:
            pass
        info["target_ssid"] = target
        return "applying", info
        
    # 2. Client connected check (wlan0 has LAN IP != 192.168.4.1)
    try:
        out = subprocess.run(["ip", "-4", "addr", "show", "wlan0"],
                             capture_output=True, text=True, timeout=1.5)
        wlan_ips = [ip for ip in re.findall(r"inet\s+([\d.]+)", out.stdout) if ip != "192.168.4.1"]
        if wlan_ips:
            info["ip"] = wlan_ips[0]
            info["target_ssid"] = "Rede Wi-Fi"
            return "connected", info
    except Exception:
        pass
        
    # 3. Failed check
    try:
        r_file = os.path.join(STATE_DIR, "result.json")
        if os.path.exists(r_file):
            r = json.load(open(r_file))
            if r.get("status") == "failed":
                age = time.time() - int(r.get("ts", 0))
                if age < 180: # erro recente
                    info["target_ssid"] = r.get("ssid", "Wi-Fi")
                    return "failed", info
    except Exception:
        pass
        
    # 4. Peer check
    if info["stations"] > 0:
        return "peer", info
        
    # 5. AP solo default
    return "ap_solo", info

def qr_tile(data, size=350):
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=10, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        return img.resize((size, size), Image.NEAREST)
    except Exception:
        out = os.path.join(tempfile.gettempdir(), f"qr_{abs(hash(data)) % 99999}.png")
        subprocess.run(["qrencode", "-s", "10", "-m", "2", "-o", out, data], check=True, capture_output=True)
        img = Image.open(out).convert("RGB")
        return img.resize((size, size), Image.NEAREST)

def render_header(d, title, subtitle, badge_col=None, sx=0, sy=0):
    cx = W // 2 + sx
    font_title = F("Inter-Bold.ttf", 44)
    font_sub = F("Inter-Medium.ttf", 21)
    
    if badge_col:
        bbox = d.textbbox((0, 0), title, font=font_title)
        tw = bbox[2] - bbox[0]
        dot_r = 7
        gap = 18
        tot_w = dot_r * 2 + gap + tw
        start_x = cx - tot_w // 2
        dot_cx = start_x + dot_r
        d.ellipse([dot_cx - dot_r, 130 + sy - dot_r, dot_cx + dot_r, 130 + sy + dot_r], fill=badge_col)
        d.text((start_x + dot_r * 2 + gap, 130 + sy), title, font=font_title, fill=TEXT_WHITE, anchor="lm")
    else:
        d.text((cx, 130 + sy), title, font=font_title, fill=TEXT_WHITE, anchor="mm")
        
    d.text((cx, 180 + sy), subtitle, font=font_sub, fill=TEXT_MUTED, anchor="mm")

def render_footer(d, info, sx=0, sy=0):
    fy = H - 56 + sy
    d.line([(80 + sx, fy), (W - 80 + sx, fy)], fill=PILL_BORDER, width=1)
    
    temp = info.get("temp", get_cpu_temp())
    ram = info.get("ram", get_ram_info())
    up = info.get("up", get_uptime())
    ip = info.get("ip", get_ip())
    mac = info.get("mac", get_mac())
    
    left_txt = f"CPU: {temp:.1f}°C   |   RAM: {ram}   |   IP: {ip}   |   Uptime: {up}"
    d.text((80 + sx, fy + 22), left_txt, font=F("Inter-Regular.ttf", 17), fill=TEXT_MUTED, anchor="lm")
    
    right_txt = f"BTV-E10   |   Amlogic S905X2   |   1080p@60Hz   |   MAC: {mac}"
    d.text((W - 80 + sx, fy + 22), right_txt, font=F("JetBrainsMono-Regular.ttf", 16), fill=TEXT_FAINT, anchor="rm")

def render_qr_box(d, img, cx, cy, qr_img, qr_size):
    pad = 18
    box_w = qr_size + pad * 2
    d.rounded_rectangle([cx - box_w//2, cy - box_w//2, cx + box_w//2, cy + box_w//2],
                        radius=16, fill=(255, 255, 255), outline=(220, 226, 235), width=2)
    img.paste(qr_img, (cx - qr_size//2, cy - qr_size//2))

def render_pill(d, cx, cy, text, text_col=ACCENT_BLUE):
    font = F("JetBrainsMono-Bold.ttf", 20)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pw = tw + 56
    ph = th + 24
    d.rounded_rectangle([cx - pw//2, cy - ph//2, cx + pw//2, cy + ph//2],
                        radius=10, fill=PILL_BG, outline=PILL_BORDER, width=1)
    d.text((cx, cy), text, font=font, fill=text_col, anchor="mm")

# --- RENDERIZADORES DE CADA ESTADO ---

def render_ap_solo(d, img, info, sx=0, sy=0):
    cx = W // 2 + sx
    render_header(d, "MultiForge Setup", "Ponto de Acesso de Configuração Ativo", None, sx, sy)
    
    ssid = info.get("ssid", "Forge-E10")
    pwd = info.get("password", "forgehub")
    qr = qr_tile(f"WIFI:S:{ssid};T:WPA;P:{pwd};;", size=350)
    render_qr_box(d, img, cx, 440 + sy, qr, 350)
    
    d.text((cx, 680 + sy), "Aponte a câmera do celular para conectar ao Wi-Fi",
           font=F("Inter-SemiBold.ttf", 26), fill=TEXT_WHITE, anchor="mm")
    render_pill(d, cx, 740 + sy, f"Wi-Fi: {ssid}   •   Senha: {pwd}", ACCENT_BLUE)
    d.text((cx, 805 + sy), "Sem internet neste passo: normal. O instalador web abrirá em seguida.",
           font=F("Inter-Regular.ttf", 19), fill=TEXT_FAINT, anchor="mm")

def render_peer(d, img, info, sx=0, sy=0):
    cx = W // 2 + sx
    render_header(d, "Celular Conectado ao Wi-Fi", "Aparelho detectado  •  Abra o instalador para configurar a rede", ACCENT_GREEN, sx, sy)
    
    qr = qr_tile(PORTAL_AP_URL, size=350)
    render_qr_box(d, img, cx, 440 + sy, qr, 350)
    
    d.text((cx, 680 + sy), "Escaneie o QR Code para abrir o Instalador Web",
           font=F("Inter-SemiBold.ttf", 26), fill=TEXT_WHITE, anchor="mm")
    render_pill(d, cx, 740 + sy, f"Endereço: {PORTAL_AP_URL}", ACCENT_GREEN)
    d.text((cx, 805 + sy), "Ou acerte o acesso pelo navegador do celular em http://192.168.4.1:8080",
           font=F("Inter-Regular.ttf", 19), fill=TEXT_FAINT, anchor="mm")

def render_applying(d, img, info, sx=0, sy=0):
    cx = W // 2 + sx
    target = info.get("target_ssid", "MultiForge-Lab-5G")
    render_header(d, "Conectando à Rede...", f"Aplicando credenciais para '{target}'", ACCENT_AMBER, sx, sy)
    
    # Dark card container for stepper
    cw, ch = 760, 360
    cy = 460 + sy
    d.rounded_rectangle([cx - cw//2, cy - ch//2, cx + cw//2, cy + ch//2],
                        radius=16, fill=PILL_BG, outline=PILL_BORDER, width=1)
    
    steps = [
        ("1. Associando ao Wi-Fi", True),
        ("2. Obtendo IP via DHCP", "active"),
        ("3. Validando Conexão com a Internet", False),
    ]
    
    sy_step = cy - 80
    for label, st in steps:
        if st is True:
            d.ellipse([cx - 240, sy_step - 16, cx - 208, sy_step + 16], fill=ACCENT_GREEN)
            d.text((cx - 224, sy_step), "✓", font=F("Inter-Bold.ttf", 18), fill=(13, 17, 23), anchor="mm")
            d.text((cx - 188, sy_step), label, font=F("Inter-SemiBold.ttf", 24), fill=TEXT_WHITE, anchor="lm")
        elif st == "active":
            d.ellipse([cx - 240, sy_step - 16, cx - 208, sy_step + 16], outline=ACCENT_AMBER, width=3)
            d.ellipse([cx - 229, sy_step - 5, cx - 219, sy_step + 5], fill=ACCENT_AMBER)
            d.text((cx - 188, sy_step), label, font=F("Inter-Bold.ttf", 24), fill=ACCENT_AMBER, anchor="lm")
        else:
            d.ellipse([cx - 240, sy_step - 16, cx - 208, sy_step + 16], outline=PILL_BORDER, width=2)
            d.text((cx - 188, sy_step), label, font=F("Inter-Medium.ttf", 24), fill=TEXT_FAINT, anchor="lm")
        sy_step += 60
        
    bar_w, bar_h = 520, 8
    bx, by = cx - bar_w // 2, cy + 110
    d.rounded_rectangle([bx, by, bx + bar_w, by + bar_h], radius=4, fill=BG)
    d.rounded_rectangle([bx, by, bx + int(bar_w * 0.65), by + bar_h], radius=4, fill=ACCENT_AMBER)
    
    d.text((cx, 720 + sy), "A TV Box está se conectando de forma autônoma.",
           font=F("Inter-Medium.ttf", 23), fill=TEXT_WHITE, anchor="mm")
    d.text((cx, 765 + sy), "Caso ocorra falha, o ponto de acesso será restaurado em até 60 segundos.",
           font=F("Inter-Regular.ttf", 19), fill=TEXT_FAINT, anchor="mm")

def render_connected(d, img, info, sx=0, sy=0):
    cx = W // 2 + sx
    target = info.get("target_ssid", "MultiForge-Lab-5G")
    ip = info.get("ip", get_ip())
    hub_url = f"http://{ip}:8080"
    
    render_header(d, "ForgeHub Operacional", f"Conectado à rede '{target}'  •  Dispositivo pronto para uso", ACCENT_GREEN, sx, sy)
    
    qr = qr_tile(hub_url, size=350)
    render_qr_box(d, img, cx, 440 + sy, qr, 350)
    
    d.text((cx, 680 + sy), "Aponte o celular para abrir o Painel ForgeHub",
           font=F("Inter-SemiBold.ttf", 26), fill=TEXT_WHITE, anchor="mm")
    render_pill(d, cx, 740 + sy, f"Dashboard: {hub_url}", ACCENT_GREEN)
    d.text((cx, 805 + sy), f"Ou acesse pelo navegador de qualquer computador na rede: {hub_url}",
           font=F("Inter-Regular.ttf", 19), fill=TEXT_FAINT, anchor="mm")

def render_failed(d, img, info, sx=0, sy=0):
    cx = W // 2 + sx
    failed_ssid = info.get("target_ssid", "Wi-Fi")
    ap_ssid = info.get("ssid", "Forge-E10")
    pwd = info.get("password", "forgehub")
    
    render_header(d, "Falha na Conexão", f"A rede '{failed_ssid}' não respondeu ou a senha está incorreta", ACCENT_RED, sx, sy)
    
    qr = qr_tile(f"WIFI:S:{ap_ssid};T:WPA;P:{pwd};;", size=350)
    render_qr_box(d, img, cx, 440 + sy, qr, 350)
    
    d.text((cx, 680 + sy), "Ponto de Acesso Restaurado com Sucesso",
           font=F("Inter-SemiBold.ttf", 26), fill=TEXT_WHITE, anchor="mm")
    render_pill(d, cx, 740 + sy, f"Reconecte ao Wi-Fi: {ap_ssid} (Senha: {pwd})", ACCENT_AMBER)
    d.text((cx, 805 + sy), "Nada foi perdido. Aponte a câmera para reconectar e tente novamente no instalador.",
           font=F("Inter-Regular.ttf", 19), fill=TEXT_FAINT, anchor="mm")

def render(mode, info, sx=0, sy=0):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    if mode == "ap_solo":
        render_ap_solo(d, img, info, sx, sy)
    elif mode == "peer":
        render_peer(d, img, info, sx, sy)
    elif mode == "applying":
        render_applying(d, img, info, sx, sy)
    elif mode == "connected":
        render_connected(d, img, info, sx, sy)
    elif mode == "failed":
        render_failed(d, img, info, sx, sy)
    else:
        render_ap_solo(d, img, info, sx, sy)
    render_footer(d, info, sx, sy)
    return img

def push(img):
    data = img.convert("RGBA").tobytes("raw", "BGRA") + b"\x00" * (1080 * LINE_LEN)
    with open(FB, "wb") as f:
        f.write(data)

def main():
    print("MultiForge Obsidian Minimalist Kiosk v3.3 starting...")
    tick = 0
    while True:
        try:
            mode, info = get_state()
            shift_x = (tick // 60) % 3 - 1
            shift_y = (tick // 120) % 3 - 1
            img = render(mode, info, shift_x, shift_y)
            push(img)
            img.save("/tmp/fb0_active_screen.png")
            tick += 1
        except Exception as e:
            sys.stderr.write(f"Error in kiosk loop: {e}\n")
        time.sleep(2)

if __name__ == "__main__":
    main()
