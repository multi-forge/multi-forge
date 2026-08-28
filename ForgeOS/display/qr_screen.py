#!/usr/bin/env python3
"""MultiForge Kiosk v2 — industrial/IoT dark UI (1920x1080 fb).

Paleta: bg #0B0F19 · accent #F97316 · glass rgba(30,41,59,.7) · border #334155
Tipografia: Inter (UI) · JetBrains Mono (dados)
"""
import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FB = "/dev/fb0"
LINE_LEN = 7680
BPP = 4
BASE = os.environ.get("FORGEOS_BASE", "/opt/forgeos" if os.path.exists("/opt/forgeos") else os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATE = os.path.join(BASE, "state")
FONTS = os.path.join(BASE, "display", "fonts")

# ---- paleta ----
BG = (11, 15, 25)          # #0B0F19
GRID = (21, 29, 46)        # dot grid sutil
GLASS = (24, 33, 47)       # rgba(30,41,59,0.7) sobre BG
BORDER = (51, 65, 85)      # #334155
ACCENT = (249, 115, 22)    # #F97316
ACCENT_D = (234, 88, 12)   # #EA580C
TXT = (241, 245, 249)      # #F1F5F9
TXT2 = (148, 163, 184)     # #94A3B8
TXT3 = (100, 116, 139)     # #64748B
CHIP_BG = (15, 23, 42)     # #0F172A
GREEN = (34, 197, 94)      # #22C55E
RED = (239, 68, 68)        # #EF4444
FOOT_BG = (13, 19, 34)

AP_SSID = "RTL8189FTV_AP"
AP_PASS = "tvbox12345"
PORTAL_URL = "http://192.168.4.1"


def F(name, size):
    p = os.path.join(FONTS, name)
    if Path(p).exists():
        return ImageFont.truetype(p, size)
    return ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)


def get_mac():
    try:
        return open("/sys/class/net/wlan0/address").read().strip().upper()
    except Exception:
        return "00:00:00:00:00:00"


def get_state():
    try:
        r = json.load(open(os.path.join(STATE, "result.json")))
        return r.get("status"), r.get("ssid"), r.get("ip")
    except Exception:
        return None, None, None


def qr_png(data, box):
    """QR normalizado em box x box (NEAREST preserva módulos nítidos)."""
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=12, border=0)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        return img.resize((box, box), Image.NEAREST)
    except Exception:
        import tempfile
        out = os.path.join(tempfile.gettempdir(), f"qr_{abs(hash(data)) % 9999}.png")
        subprocess.run(["qrencode", "-s", "12", "-m", "0", "-o", out, data],
                       check=True, capture_output=True)
        img = Image.open(out).convert("RGB")
        return img.resize((box, box), Image.NEAREST)


def render():
    W, H = 1920, 1080
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # dot grid sutil (industrial)
    for gy in range(48, H - 40, 48):
        for gx in range(48, W - 40, 48):
            d.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=GRID)

    # ---------- header ----------
    d.rounded_rectangle([80, 48, 144, 112], radius=18, fill=ACCENT)
    d.text((112, 79), "M", font=F("Inter-Bold.ttf", 40), fill="white", anchor="mm")
    d.text((168, 68), "MultiForge", font=F("Inter-Bold.ttf", 44), fill=TXT, anchor="lm")

    badge_txt = "P R O V I S I O N A M E N T O"
    bf = F("Inter-SemiBold.ttf", 17)
    bw = d.textlength(badge_txt, font=bf)
    d.rounded_rectangle([448, 52, 448 + bw + 44, 92], radius=20,
                        outline=ACCENT, width=2)
    d.text((448 + 22 + bw / 2, 72), badge_txt, font=bf, fill=ACCENT, anchor="mm")

    d.text((168, 122), "BTV E10  •  Siga os passos abaixo para configurar o dispositivo.",
           font=F("Inter-Regular.ttf", 21), fill=TXT2, anchor="lm")

    # ---------- cards ----------
    cw, chh, gap = 600, 740, 80
    sx = (W - (cw * 2 + gap)) // 2
    cy = 200

    qr_wifi = qr_png(f"WIFI:S:{AP_SSID};T:WPA;P:{AP_PASS};;", 260)
    qr_url = qr_png(PORTAL_URL, 260)

    cards = [
        (sx, "01", "Conecte ao Wi-Fi", qr_wifi,
         [("REDE", AP_SSID, TXT), ("SENHA", AP_PASS, TXT)],
         "Aponte a câmera do celular para conectar"),
        (sx + cw + gap, "02", "Acesse o Painel", qr_url,
         [("URL", PORTAL_URL, ACCENT), ("SERVIÇO", "Portal de Configuração", TXT)],
         "Escaneie para abrir o painel de configuração"),
    ]

    mono_l = F("JetBrainsMono-Regular.ttf", 15)
    mono_v = F("JetBrainsMono-Medium.ttf", 21)

    for cx, num, title, qr, rows, hint in cards:
        d.rounded_rectangle([cx, cy, cx + cw, cy + chh], radius=24,
                            fill=GLASS, outline=BORDER, width=2)

        # badge circular + título
        bx, by, bd = cx + 44, cy + 44, 48
        d.ellipse([bx, by, bx + bd, by + bd], fill=ACCENT)
        d.text((bx + bd / 2, by + bd / 2 + 1), num,
               font=F("Inter-Bold.ttf", 21), fill="white", anchor="mm")
        d.text((bx + bd + 22, by + bd / 2), title,
               font=F("Inter-SemiBold.ttf", 30), fill=TXT, anchor="lm")
        d.line([cx + 44, cy + 124, cx + cw - 44, cy + 124], fill=BORDER, width=1)

        # QR: caixa branca 300px, radius 16, quiet zone
        qbox = 300
        qx = cx + (cw - qbox) // 2
        qy = cy + 156
        d.rounded_rectangle([qx, qy, qx + qbox, qy + qbox], radius=16,
                            fill="white")
        qw, qh = qr.size
        img.paste(qr, (qx + (qbox - qw) // 2, qy + (qbox - qh) // 2))

        # chips de dados
        ry = cy + 500
        for label, value, vcol in rows:
            d.rounded_rectangle([cx + 44, ry, cx + cw - 44, ry + 68],
                                radius=12, fill=CHIP_BG, outline=BORDER, width=1)
            d.text((cx + 68, ry + 12), label, font=mono_l, fill=TXT3)
            d.text((cx + 68, ry + 34), value, font=mono_v, fill=vcol)
            ry += 84

        d.text((cx + cw // 2, cy + chh - 40), hint,
               font=F("Inter-Regular.ttf", 17), fill=TXT3, anchor="mm")

    # ---------- footer ----------
    fy = H - 70
    d.rectangle([0, fy, W, H], fill=FOOT_BG)
    d.line([0, fy, W, fy], fill=BORDER, width=2)

    st, ssid, ip = get_state()
    if st == "connected":
        dot, txt = GREEN, f"Conectado a {ssid}  •  IP {ip}"
    elif st == "failed":
        dot, txt = RED, f"Falha ao conectar em {ssid}  •  AP restaurado"
    else:
        dot, txt = GREEN, "Modo Ponto de Acesso (AP) Ativo  •  Aguardando conexão do usuário..."

    d.ellipse([88, fy + 26, 102, fy + 40], fill=dot)
    d.ellipse([84, fy + 22, 106, fy + 44], outline=dot, width=2)
    d.text((126, fy + 33), txt, font=F("Inter-Medium.ttf", 19), fill=(203, 213, 225),
           anchor="lm")
    info = f"ForgeOS v1.0  •  MAC {get_mac()}"
    d.text((W - 80, fy + 33), info, font=F("JetBrainsMono-Regular.ttf", 16),
           fill=TXT3, anchor="rm")

    out = os.path.join(tempfile.gettempdir(), "forge_display.png")
    img.save(out)
    return out, fy


def push(png, footer_y=None):
    data = Image.open(png).convert("RGBA").tobytes("raw", "BGRA")
    with open(FB, "wb") as f:
        f.write(data)
        f.write(b"\x00" * (1080 * LINE_LEN))


def push_footer_band(png, footer_y):
    """Reescreve apenas a faixa do rodapé (para pulsar o dot sem flicker)."""
    band_h = 1080 - footer_y
    img = Image.open(png).convert("RGBA")
    band = img.crop((0, footer_y, 1920, 1080)).tobytes("raw", "BGRA")
    with open(FB, "r+b") as f:
        f.seek(footer_y * LINE_LEN)
        f.write(band)


def pulse_variants(png, footer_y):
    """Gera bandas on/off do rodapé alternando o brilho do dot."""
    img = Image.open(png).convert("RGBA")
    variants = []
    for dim in (0.35, 1.0):
        v = img.copy()
        d = ImageDraw.Draw(v)
        st, ssid, ip = get_state()
        color = GREEN if st != "failed" else RED
        c = tuple(int(x * dim) for x in color)
        d.ellipse([88, footer_y + 26, 102, footer_y + 40], fill=c)
        d.ellipse([84, footer_y + 22, 106, footer_y + 44], outline=c, width=2)
        band = v.crop((0, footer_y, 1920, 1080)).tobytes("raw", "BGRA")
        variants.append(band)
    return variants


def main():
    try:
        open("/sys/class/vtconsole/vtcon1/bind", "w").write("0")
    except Exception:
        pass
    subprocess.run("setterm -cursor off > /dev/tty1 2>&1 || true", shell=True)

    png, fy = render()
    push(png)
    variants = pulse_variants(png, fy)
    last_state = str(get_state())
    i = 0
    while True:
        time.sleep(0.8)
        i += 1
        try:
            with open(FB, "r+b") as f:
                f.seek(fy * LINE_LEN)
                f.write(variants[i % 2])
        except Exception:
            pass
        cur = str(get_state())
        if cur != last_state:
            last_state = cur
            png, fy = render()
            push(png)
            variants = pulse_variants(png, fy)


if __name__ == "__main__":
    main()
