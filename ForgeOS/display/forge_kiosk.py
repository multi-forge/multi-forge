#!/usr/bin/env python3
"""ForgeOS Kiosk Engine v3.1 — progressive pairing display on /dev/fb0.

Enterprise light theme (Ubiquiti/Tailwind/Apple-setup style):
slate base, SOLID WHITE cards, corporate blue, sober semantic colors.
No gradients, no neon glow, 8px spacing scale.

State machine (one QR focus at a time, progressive reveal):

    AP_SOLO  ->  PEER  ->  APPLYING  ->  CONNECTED
       ^           |            |              ^
       |           v            v              |
       +-- (station leaves / timeout)   FAILED -+

No browser, no GPU, no new dependencies: stdlib + Pillow + qrcode
(with qrencode CLI fallback).
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
LINE_LEN = 7680  # 1920 * 4 (BGRA)
BASE = os.environ.get(
    "FORGEOS_BASE",
    "/opt/forgeos" if os.path.exists("/opt/forgeos")
    else os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)
STATE = os.path.join(BASE, "state")
FONTS = os.path.join(BASE, "display", "fonts")
WEB = os.path.join(BASE, "web")

PORTAL_AP_URL = "http://192.168.4.1:8080"
DIM_IDLE_SEC = 300
REFRESH_SEC = 30

# ---- Enterprise light tokens -----------------------------------------
BG = (15, 23, 42)             # slate-900 base, flat
CARD = (255, 255, 255)        # solid white surface
CARD_BORDER = (226, 232, 240)  # slate-200 hairline
CHIP_BG = (248, 250, 252)     # slate-50 inset
TXT_TITLE = (15, 23, 42)      # slate-900
TXT_BODY = (51, 65, 85)       # slate-700
TXT_MUTED = (100, 116, 139)   # slate-500
TXT_FAINT = (148, 163, 184)   # slate-400
BLUE = (37, 99, 235)          # corporate primary
GREEN = (22, 163, 74)         # success
RED = (220, 38, 38)           # sober error
RED_DARK = (185, 28, 28)
RED_TINT = (254, 226, 226)
AMBER = (217, 119, 6)         # progress / warning
GREEN_TINT = (240, 253, 244)
GREEN_TINT_BORDER = (187, 247, 208)
GREEN_DARK = (20, 83, 45)
FOOT_BG = (2, 6, 23)
# pill/dot hues for the dark header + footer
PILL_BLUE = (96, 165, 250)
PILL_GREEN = (74, 222, 128)
PILL_AMBER = (251, 191, 36)
PILL_RED = (248, 113, 113)
PILL_GRAY = (148, 163, 184)

BADGES = {
    "ap_solo": ("P A R E A M E N T O", PILL_BLUE),
    "peer": ("C E L U L A R  C O N E C T A D O", PILL_BLUE),
    "applying": ("C O N E C T A N D O", PILL_AMBER),
    "connected": ("O P E R A C I O N A L", PILL_GREEN),
    "failed": ("A T E N C A O", PILL_RED),
}

TEMP_HIST = []
TEMP_HIST_MAX = 40


def F(name, size):
    p = os.path.join(FONTS, name)
    if Path(p).exists():
        return ImageFont.truetype(p, size)
    for fb in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if "Bold" in name
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ):
        if Path(fb).exists():
            return ImageFont.truetype(fb, size)
    return ImageFont.load_default()


# ---------------------------------------------------------------- inputs ---
def read_ap_config():
    cfg = {"ssid": "ForgeOS-AP", "password": "", "channel": 6}
    try:
        with open(os.path.join(BASE, "network", "wpa_ap.conf")) as f:
            content = f.read()
        m = re.search(r'ssid="([^"]+)"', content)
        if m:
            cfg["ssid"] = m.group(1)
        m = re.search(r'psk="([^"]+)"', content)
        if m:
            cfg["password"] = m.group(1)
        m = re.search(r"frequency=([0-9]+)", content)
        if m:
            freq = int(m.group(1))
            cfg["channel"] = (freq - 2407) // 5 if freq < 3000 else (freq - 5000) // 5
    except OSError:
        pass
    return cfg


def _ips(iface):
    try:
        out = subprocess.run(
            ["ip", "-4", "addr", "show", iface],
            capture_output=True, text=True, timeout=2,
        )
        return re.findall(r"inet\s+([\d.]+)", out.stdout)
    except Exception:
        return []


def get_mac():
    try:
        return open("/sys/class/net/wlan0/address").read().strip().upper()
    except Exception:
        return "--:--:--:--:--:--"


SEEN_FILE = os.path.join(STATE, "sta_seen.json")
PROBE_EVERY = 3  # re-checagem ativa a cada 3 s (não 10 s)
PROBE_BUDGET = 0.8
MAX_MISSES = 2  # 1 falha pontual não tira do PEER; 2 falhas consecutivas retornam


def _associated_stas():
    """Retorna lista de MACs associados no rádio (Layer 2) via wpa_supplicant AP.
    Se nenhuma estação estiver associada, retorna [] instantaneamente (5 ms).
    """
    try:
        res = subprocess.run(
            ["wpa_cli", "-p", "/var/run/wpa_supplicant-ap", "list_sta"],
            capture_output=True, text=True, timeout=0.8,
        )
        if res.returncode == 0:
            stas = []
            for ln in res.stdout.splitlines():
                ln = ln.strip().lower()
                if len(ln) == 17 and ln.count(":") == 5:
                    stas.append(ln)
            return stas
    except Exception:
        pass
    return None


def _lease_ips(now):
    ips = []
    for lf in ("/var/lib/misc/dnsmasq.leases", "/var/lib/dnsmasq/dnsmasq.leases",
               "/tmp/dnsmasq.leases"):
        try:
            with open(lf) as f:
                for ln in f:
                    cols = ln.split()
                    try:
                        if len(cols) > 2 and int(cols[0]) > now and cols[2].startswith("192.168.4."):
                            ips.append(cols[2])
                    except (ValueError, IndexError):
                        pass
        except OSError:
            pass
    return ips


def _ping_alive(ips, budget=PROBE_BUDGET):
    """Pings paralelos rápidos (timeout 0.4s); retorna IPs que responderam."""
    procs = []
    for ip in list(dict.fromkeys(ips))[:4]:
        try:
            procs.append((ip, subprocess.Popen(
                ["ping", "-c", "1", "-W", "0.4", "-I", "wlan0", ip],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)))
        except Exception:
            pass
    if not procs:
        return []
    alive, pending = [], dict(procs)
    deadline = time.time() + budget
    while pending and time.time() < deadline:
        for ip, p in list(pending.items()):
            if p.poll() is not None:
                if p.returncode == 0:
                    alive.append(ip)
                del pending[ip]
        time.sleep(0.03)
    for _, p in pending.items():
        try:
            p.kill()
        except Exception:
            pass
    return alive


def _save_seen(ts, probe, ips, misses):
    try:
        json.dump({"ts": ts, "probe": probe, "ips": ips, "misses": misses},
                  open(SEEN_FILE, "w"))
    except OSError:
        pass


def station_count():
    """Celulares realmente no AP agora.

    1. Checagem direta Layer 2 via wpa_supplicant: se o celular desligou o Wi-Fi,
       o rádio já sabe imediatamente (deauth). Retorna 0 em < 1 segundo.
    2. Sondagem ativa ICMP ping a cada PROBE_EVERY (3 s) com timeout de 0.4 s.
    3. Se houver falha de ping, re-sonda imediatamente no próximo segundo (probe=0),
       confirmando ausência sem esperar janela de ARP de 30 s do kernel.
    """
    now = int(time.time())

    # 1. Rádio / associação Wi-Fi direta (Layer 2)
    stas = _associated_stas()
    if stas is not None and len(stas) == 0:
        try:
            os.remove(SEEN_FILE)
        except OSError:
            pass
        return 0

    try:
        out = subprocess.run(["ip", "-o", "neigh", "show", "dev", "wlan0"],
                             capture_output=True, text=True, timeout=1.5)
        reach = [ln.split()[0] for ln in out.stdout.splitlines() if " REACHABLE " in ln]
    except Exception:
        reach = None
    if reach is None and stas is None:
        return len(_lease_ips(now))

    try:
        meta = json.load(open(SEEN_FILE))
        last_probe = int(meta.get("probe", 0))
    except Exception:
        last_probe, meta = 0, {}
    try:
        prev_ts, prev_ips = int(meta.get("ts", 0)), list(meta.get("ips", []))
    except Exception:
        prev_ts, prev_ips = 0, []
    try:
        misses = int(meta.get("misses", 0))
    except Exception:
        misses = 0

    candidates = list(dict.fromkeys((reach or []) + prev_ips + _lease_ips(now)))[:4]
    if not candidates:
        try:
            os.remove(SEEN_FILE)
        except OSError:
            pass
        return 0

    if reach and now - last_probe < PROBE_EVERY and misses == 0:
        _save_seen(prev_ts or now, last_probe, reach, 0)
        return len(reach)

    alive = _ping_alive(candidates)
    if alive:
        _save_seen(now, now, alive, 0)
        return len(alive)

    misses += 1
    if misses >= MAX_MISSES or not prev_ts:
        try:
            os.remove(SEEN_FILE)
        except OSError:
            pass
        return 0

    # Em caso de falha, resonda imediatamente no próximo segundo (probe=0)
    _save_seen(prev_ts, 0, prev_ips, misses)
    return len(prev_ips) or 1


def client_active():
    try:
        out = subprocess.run(
            ["pgrep", "-f", "wpa_supplicant.*client.conf"],
            capture_output=True, text=True,
        )
        if out.returncode != 0:
            return False
    except Exception:
        return False
    return any(ip != "192.168.4.1" for ip in _ips("wlan0"))


def get_state(fake=None):
    if fake is not None:
        return fake["mode"], fake
    info = {"stations": station_count()}
    if os.path.exists(os.path.join(STATE, "applying")):
        target = "Wi-Fi"
        try:
            target = json.load(open(os.path.join(STATE, "provision.json"))).get("ssid", target)
        except Exception:
            pass
        info["target"] = target
        try:
            info["progress"] = json.load(open(os.path.join(STATE, "progress.json")))
        except Exception:
            info["progress"] = {"phase": "assoc"}
        return "applying", info
    wlan = _ips("wlan0")
    cip = next((ip for ip in wlan if ip != "192.168.4.1"), None)
    if client_active() and cip:
        ssid = "Rede Wi-Fi"
        for fn in ("provision.json", "result.json"):
            try:
                ssid = json.load(open(os.path.join(STATE, fn))).get("ssid", ssid)
                if ssid != "Rede Wi-Fi":
                    break
            except Exception:
                pass
        info["ssid"] = ssid
        info["ip"] = cip
        return "connected", info
    try:
        r = json.load(open(os.path.join(STATE, "result.json")))
        if r.get("status") == "failed":
            try:
                age = time.time() - int(r.get("ts", 0))
            except (ValueError, TypeError):
                age = 0
            if age < 300:  # erro recente: mostra FAILED; depois volta a AP_SOLO
                info["ssid"] = r.get("ssid", "Wi-Fi")
                return "failed", info
    except Exception:
        pass
    if info["stations"] > 0:
        return "peer", info
    return "ap_solo", info


def get_telemetry():
    temp_c = 0.0
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            temp_c = round(int(f.read().strip()) / 1000.0, 1)
    except Exception:
        pass
    TEMP_HIST.append(temp_c)
    del TEMP_HIST[:-TEMP_HIST_MAX]
    ram_str = "--"
    try:
        tot, av = 0, 0
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    tot = int(line.split()[1]) // 1024
                elif line.startswith("MemAvailable:"):
                    av = int(line.split()[1]) // 1024
        if tot:
            ram_str = "%d MB / %.2f GB" % (tot - av, tot / 1024)
    except Exception:
        pass
    up_str = "--"
    try:
        with open("/proc/uptime") as f:
            sec = int(float(f.read().split()[0]))
        up_str = "%dh %02dm" % (sec // 3600, (sec % 3600) // 60)
    except Exception:
        pass
    return temp_c, ram_str, up_str


def qr_png(data, box_size):
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=10, border=2,
                           error_correction=qrcode.constants.ERROR_CORRECT_M)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        return img.resize((box_size, box_size), Image.NEAREST)
    except Exception:
        out = os.path.join(tempfile.gettempdir(), "qr_%d.png" % (abs(hash(data)) % 99999))
        subprocess.run(["qrencode", "-s", "10", "-m", "2", "-o", out, data],
                       check=True, capture_output=True)
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # qrencode emite paleta+tRNS: ruido de log
            img = Image.open(out).convert("RGB")
        return img.resize((box_size, box_size), Image.NEAREST)


# ---------------------------------------------------------------- drawing --
def _gear(d, cx, cy, r, col):
    for k in range(8):
        a = math.pi / 4 * k
        dx, dy = math.cos(a), math.sin(a)
        px, py = -dy, dx
        r0, r1, hw = r * 0.78, r * 1.12, r * 0.16
        pts = [
            (cx + dx * r0 + px * hw, cy + dy * r0 + py * hw),
            (cx + dx * r1 + px * hw, cy + dy * r1 + py * hw),
            (cx + dx * r1 - px * hw, cy + dy * r1 - py * hw),
            (cx + dx * r0 - px * hw, cy + dy * r0 - py * hw),
        ]
        d.polygon(pts, fill=col)
    d.ellipse([cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82], fill=col)
    d.ellipse([cx - r * 0.34, cy - r * 0.34, cx + r * 0.34, cy + r * 0.34], fill=BG)


def _header(d, img, mode, sx, sy):
    safe_l, safe_t = 96 + sx, 48 + sy
    size = 76
    logo_path = os.path.join(WEB, "logo.png")
    if Path(logo_path).exists():
        try:
            logo = Image.open(logo_path).convert("RGBA").resize((size, size), Image.LANCZOS)
            img.paste(logo, (safe_l, safe_t), logo)
        except Exception:
            _gear(d, safe_l + 38, safe_t + 38, 32, (203, 213, 225))
    else:
        _gear(d, safe_l + 38, safe_t + 38, 32, (203, 213, 225))
    tx = safe_l + 100
    title_font = F("Inter-Bold.ttf", 46)
    d.text((tx, safe_t + 24), "ForgeOS", font=title_font, fill=(255, 255, 255), anchor="lm")
    title_w = d.textlength("ForgeOS", font=title_font)
    badge_txt, badge_col = BADGES[mode]
    badge_font = F("Inter-Bold.ttf", 15)
    pad = 34
    ink = d.textbbox((0, 0), badge_txt, font=badge_font)
    badge_w = (ink[2] - ink[0]) + pad * 2
    bx = tx + title_w + 26
    d.rounded_rectangle([bx, safe_t + 10, bx + badge_w, safe_t + 40],
                        radius=15, outline=(100, 116, 139), width=2)
    d.text((bx + badge_w / 2, safe_t + 25), badge_txt,
           font=badge_font, fill=badge_col, anchor="mm")
    d.text((tx, safe_t + 68), "SEI Robotics SEI510 (BTV E10)  |  Amlogic S905X2  |  Armbian Appliance",
           font=F("Inter-Medium.ttf", 22), fill=TXT_FAINT, anchor="lm")


FOOTERS = {
    "ap_solo": (PILL_BLUE, "Ponto de acesso ativo  |  Aguardando o celular..."),
    "peer": (PILL_BLUE, "Celular associado ao AP  |  Abra o instalador no navegador..."),
    "applying": (PILL_AMBER, "Conectando a rede Wi-Fi...  |  Sem acao necessaria"),
    "connected": (PILL_GREEN, None),
    "failed": (PILL_RED, "Falha na conexao  |  AP restaurado, tente de novo."),
}


def _footer(d, mode, info, sx, sy):
    fy = H - 64 + sy
    d.rectangle([0, fy, W, H], fill=FOOT_BG)
    d.line([0, fy, W, fy], fill=(30, 41, 59), width=2)
    col, txt = FOOTERS[mode]
    if txt is None:
        txt = "Modo cliente ativo  |  %s (%s)" % (info.get("ssid", "?"), info.get("ip", "?"))
    dx, dy = 96 + sx, fy + 32
    d.ellipse([dx, dy - 8, dx + 16, dy + 8], fill=col)
    d.text((dx + 34, dy), txt, font=F("Inter-Medium.ttf", 21),
           fill=(203, 213, 225), anchor="lm")
    d.text((W - 96 + sx, dy), "BTV-E10  |  Kiosk v3.1  |  MAC %s" % get_mac(),
           font=F("JetBrainsMono-Regular.ttf", 18), fill=TXT_FAINT, anchor="rm")


def _qr_block(d, img, cx, cy, box, qr_img):
    d.rounded_rectangle([cx - box // 2, cy - box // 2,
                         cx + box // 2, cy + box // 2],
                        radius=16, fill=(255, 255, 255),
                        outline=CARD_BORDER, width=2)
    img.paste(qr_img, (cx - qr_img.size[0] // 2, cy - qr_img.size[1] // 2))


def _chip(d, x, y, w, h, label, value, vcol):
    d.rounded_rectangle([x, y, x + w, y + h], radius=12,
                        fill=CHIP_BG, outline=CARD_BORDER, width=1)
    d.text((x + 20, y + 14), label, font=F("JetBrainsMono-Bold.ttf", 15), fill=TXT_MUTED)
    d.text((x + 20, y + 42), value, font=F("JetBrainsMono-Bold.ttf", 30), fill=vcol)


def _card(d, x, y, w, h, num, num_bg, num_fg, title):
    d.rounded_rectangle([x, y, x + w, y + h], radius=16,
                        fill=CARD, outline=CARD_BORDER, width=2)
    bx, by, bd = x + 36, y + 32, 52
    d.ellipse([bx, by, bx + bd, by + bd], fill=num_bg)
    d.text((bx + bd / 2, by + bd / 2), num, font=F("Inter-Bold.ttf", 28),
           fill=num_fg, anchor="mm")
    d.text((bx + bd + 20, by + bd / 2), title, font=F("Inter-Bold.ttf", 34),
           fill=TXT_TITLE, anchor="lm")
    d.line([x + 36, y + 100, x + w - 36, y + 100], fill=CARD_BORDER, width=1)


def _hint(d, cx, y, line1, line2):
    d.text((cx, y), line1, font=F("Inter-Medium.ttf", 20), fill=TXT_MUTED, anchor="mm")
    d.text((cx, y + 30), line2, font=F("Inter-Regular.ttf", 17), fill=TXT_FAINT, anchor="mm")


def _sparkline(d, x, y, w, h, data):
    if len(data) < 5:
        return
    lo, hi = min(data), max(data)
    span = (hi - lo) or 1.0
    pts = []
    for i, v in enumerate(data):
        px = x + i * w / max(len(data) - 1, 1)
        py = y + h - (v - lo) / span * h
        pts.append((px, py))
    d.line(pts, fill=BLUE, width=3, joint="curve")


# ----------------------------------------------------------------- states --
def render_ap_solo(d, img, ap, sx, sy):
    cy, cw, chh = 48 + sy + 128, 780, 800
    x = (W - cw) // 2 + sx
    _card(d, x, cy, cw, chh, "\u25cf", BLUE, (255, 255, 255), "Conecte o celular ao Wi-Fi")
    if ap["password"]:
        qr = qr_png("WIFI:S:%s;T:WPA;P:%s;;" % (ap["ssid"], ap["password"]), 340)
    else:
        qr = qr_png("WIFI:S:%s;T:nopass;;" % ap["ssid"], 340)
    _qr_block(d, img, x + cw // 2, cy + 322, 340 + 40, qr)
    _chip(d, x + 40, cy + 530, cw - 80, 82, "NOME DA REDE (SSID)", ap["ssid"], TXT_TITLE)
    if ap["password"]:
        _chip(d, x + 40, cy + 624, cw - 80, 82, "SENHA", ap["password"], TXT_TITLE)
        _hint(d, x + cw // 2, cy + chh - 56,
              "Aponte a camera do celular para conectar",
              "Sem internet no AP: normal. O instalador abre em seguida.")
    else:
        _chip(d, x + 40, cy + 624, cw - 80, 82, "REDE", "aberta, sem senha", GREEN)
        _hint(d, x + cw // 2, cy + chh - 56,
              "Toque na rede para conectar",
              "Sem internet no AP: normal. O instalador abre em seguida.")


def render_peer(d, img, ap, sx, sy):
    cy, cw, chh, gap = 48 + sy + 128, 750, 736, 80
    x = (W - (cw * 2 + gap)) // 2 + sx
    _card(d, x, cy, cw, chh, "\u2713", GREEN, (255, 255, 255), "Wi-Fi conectado")
    qr = qr_png("WIFI:S:%s;T:WPA;P:%s;;" % (ap["ssid"], ap["password"]), 220) \
        if ap["password"] else qr_png("WIFI:S:%s;T:nopass;;" % ap["ssid"], 220)
    _qr_block(d, img, x + cw // 2, cy + 248, 220 + 36, qr)
    _chip(d, x + 32, cy + 400, cw - 64, 82, "REDE", ap["ssid"], TXT_TITLE)
    _chip(d, x + 32, cy + 494, cw - 64, 82, "APARELHOS",
          "1 celular", GREEN)
    _hint(d, x + cw // 2, cy + chh - 56,
          "Celular detectado no AP",
          "Agora abra o instalador ao lado.")
    x2 = x + cw + gap
    _card(d, x2, cy, cw, chh, "2", BLUE, (255, 255, 255), "Abra o instalador")
    qr2 = qr_png(PORTAL_AP_URL, 300)
    _qr_block(d, img, x2 + cw // 2, cy + 290, 300 + 36, qr2)
    _chip(d, x2 + 32, cy + 478, cw - 64, 82, "ENDERECO DO INSTALADOR",
          PORTAL_AP_URL, BLUE)
    _hint(d, x2 + cw // 2, cy + chh - 56,
          "Escaneie para abrir o provisionador",
          "Ou aguarde o portal cativo abrir sozinho.")


APPLY_STEPS = [
    ("assoc", "Associando a rede"),
    ("dhcp", "Obtendo endereco IP"),
    ("gateway", "Verificando internet"),
]


def render_applying(d, img, info, sx, sy):
    phase = (info.get("progress") or {}).get("phase", "assoc")
    order = [p for p, _ in APPLY_STEPS]
    cur = order.index(phase) if phase in order else 0
    mw, mh = 1100, 600
    mx, my = (W - mw) // 2 + sx, (H - mh) // 2 + sy
    d.rounded_rectangle([mx, my, mx + mw, my + mh], radius=16,
                        fill=CARD, outline=CARD_BORDER, width=2)
    d.text((mx + mw // 2, my + 84), "Conectando...",
           font=F("Inter-Bold.ttf", 48), fill=TXT_TITLE, anchor="mm")
    d.text((mx + mw // 2, my + 150), "Rede '%s'" % info.get("target", "Wi-Fi"),
           font=F("Inter-SemiBold.ttf", 30), fill=TXT_MUTED, anchor="mm")
    sy0 = my + 220
    for i, (_, label) in enumerate(APPLY_STEPS):
        yy = sy0 + i * 64
        xx = mx + (mw - 560) // 2
        if i < cur:
            d.ellipse([xx, yy, xx + 40, yy + 40], fill=GREEN)
            d.text((xx + 20, yy + 20), "\u2713", font=F("Inter-Bold.ttf", 22),
                   fill="white", anchor="mm")
            col = TXT_MUTED
        elif i == cur:
            d.ellipse([xx, yy, xx + 40, yy + 40], outline=AMBER, width=3)
            d.ellipse([xx + 12, yy + 12, xx + 28, yy + 28], fill=AMBER)
            col = TXT_TITLE
        else:
            d.ellipse([xx, yy, xx + 40, yy + 40], outline=CARD_BORDER, width=2)
            col = TXT_FAINT
        d.text((xx + 58, yy + 20), label, font=F("Inter-SemiBold.ttf", 28),
               fill=col, anchor="lm")
    pb_w, pb_h = 560, 12
    pb_x = mx + (mw - pb_w) // 2
    pb_y = sy0 + 3 * 64 + 10
    d.rounded_rectangle([pb_x, pb_y, pb_x + pb_w, pb_y + pb_h], radius=6, fill=CHIP_BG)
    d.rounded_rectangle([pb_x, pb_y, pb_x + int(pb_w * (cur + 1) / 3), pb_y + pb_h],
                        radius=6, fill=AMBER)
    d.text((mx + mw // 2, my + mh - 46), "A TV esta cuidando disso sozinha.",
           font=F("Inter-Regular.ttf", 22), fill=TXT_FAINT, anchor="mm")


def render_connected(d, img, info, sx, sy):
    cy, cw, chh, gap = 48 + sy + 128, 750, 736, 80
    x = (W - (cw * 2 + gap)) // 2 + sx
    hub_url = "http://%s:8080/#/modules" % info.get("ip", "0.0.0.0")
    _card(d, x, cy, cw, chh, "\u2713", GREEN, (255, 255, 255), "ForgeHub na rede")
    qr = qr_png(hub_url, 300)
    _qr_block(d, img, x + cw // 2, cy + 290, 300 + 36, qr)
    _chip(d, x + 32, cy + 478, cw - 64, 82, "ENDERECO DO FORGEHUB", hub_url, GREEN)
    _chip(d, x + 32, cy + 572, cw - 64, 82, "REDE", "%s (%s)" % (info.get("ssid", "?"), info.get("ip", "?")), TXT_TITLE)
    _hint(d, x + cw // 2, cy + chh - 30, "Escaneie para abrir o catalogo de modulos.", "")
    temp_c, ram_str, up_str = get_telemetry() if not info.get("fake") else (
        info.get("temp", 0.0), info.get("ram", "--"), info.get("up", "--"))
    x2 = x + cw + gap
    _card(d, x2, cy, cw, chh, "\u25c6", BLUE, (255, 255, 255), "Sistema")
    d.rounded_rectangle([x2 + 32, cy + 128, x2 + cw - 32, cy + 236], radius=12,
                        fill=CHIP_BG, outline=CARD_BORDER, width=1)
    d.text((x2 + 52, cy + 146), "TEMPERATURA DA CPU", font=F("JetBrainsMono-Bold.ttf", 15), fill=TXT_MUTED)
    d.text((x2 + 52, cy + 174), "%.1f C" % temp_c, font=F("JetBrainsMono-Bold.ttf", 30),
           fill=GREEN if temp_c < 75 else RED)
    _sparkline(d, x2 + cw - 272, cy + 150, 220, 64, TEMP_HIST)
    rows = [
        ("MEMORIA RAM", ram_str, TXT_TITLE),
        ("TEMPO LIGADO", up_str, TXT_TITLE),
        ("SAIDA DE VIDEO", "1080p @ 60Hz", BLUE),
        ("HOSTNAME", "armbian (ForgeOS)", TXT_TITLE),
    ]
    my = cy + 248
    for lbl, val, col in rows:
        d.rounded_rectangle([x2 + 32, my, x2 + cw - 32, my + 92], radius=12,
                            fill=CHIP_BG, outline=CARD_BORDER, width=1)
        d.text((x2 + 52, my + 18), lbl, font=F("JetBrainsMono-Bold.ttf", 15), fill=TXT_MUTED)
        d.text((x2 + 52, my + 48), val, font=F("JetBrainsMono-Bold.ttf", 26), fill=col)
        my += 104


def render_failed(d, img, info, sx, sy):
    mw, mh = 1100, 560
    mx, my = (W - mw) // 2 + sx, (H - mh) // 2 + sy
    d.rounded_rectangle([mx, my, mx + mw, my + mh], radius=16,
                        fill=CARD, outline=CARD_BORDER, width=2)
    ix, iy, ir = mx + mw // 2, my + 108, 46
    d.ellipse([ix - ir, iy - ir, ix + ir, iy + ir], fill=RED_TINT)
    d.text((ix, iy - 4), "!", font=F("Inter-Bold.ttf", 56), fill=RED, anchor="mm")
    d.text((mx + mw // 2, my + 200), "Nao foi possivel conectar",
           font=F("Inter-Bold.ttf", 46), fill=TXT_TITLE, anchor="mm")
    d.text((mx + mw // 2, my + 262), "A rede '%s' nao respondeu. Confira a senha." % info.get("ssid", "Wi-Fi"),
           font=F("Inter-SemiBold.ttf", 28), fill=RED_DARK, anchor="mm")
    d.rounded_rectangle([mx + 80, my + 318, mx + mw - 80, my + 392], radius=12,
                        fill=GREEN_TINT, outline=GREEN_TINT_BORDER, width=1)
    d.text((mx + mw // 2, my + 355), "Nada se perdeu: o ponto de acesso foi restaurado.",
           font=F("Inter-SemiBold.ttf", 26), fill=GREEN_DARK, anchor="mm")
    d.text((mx + mw // 2, my + 440), "Abra o instalador no celular e tente de novo.",
           font=F("Inter-Regular.ttf", 24), fill=TXT_MUTED, anchor="mm")


def render(mode, info, sx=0, sy=0):
    if mode.startswith("applying"):
        mode = "applying"
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    _header(d, img, mode, sx, sy)
    ap = read_ap_config() if not info.get("fake") else info.get("ap", read_ap_config())
    if mode == "ap_solo":
        render_ap_solo(d, img, ap, sx, sy)
    elif mode == "peer":
        render_peer(d, img, ap, sx, sy)
    elif mode == "applying":
        render_applying(d, img, info, sx, sy)
    elif mode == "connected":
        render_connected(d, img, info, sx, sy)
    else:
        render_failed(d, img, info, sx, sy)
    _footer(d, mode, info, sx, sy)
    return img


def push(img):
    # Frame inteiro num único write: sem clear + sem segundo write no meio,
    # o painel nunca exibe meio-frame (anti-flicker/anti-tearing).
    data = img.convert("RGBA").tobytes("raw", "BGRA") + b"\x00" * (1080 * LINE_LEN)
    with open(FB, "wb") as f:
        f.write(data)


def slide_push(old, new, frames=6, direction=1):
    # direction=+1: tela nova entra pela direita; -1: pela esquerda
    # (voltar a 1 QR desliza para a direita, movimento "de retorno").
    for i in range(1, frames + 1):
        t = i / frames
        off = int(W * (1 - (1 - t) ** 3))  # ease-out cúbico
        canvas = old.copy()
        if off < W:
            if direction >= 0:
                canvas.paste(old.crop((off, 0, W, H)), (0, 0))
                canvas.paste(new.crop((0, 0, W - off, H)), (W - off, 0))
            else:
                canvas.paste(old.crop((0, 0, W - off, H)), (off, 0))
                canvas.paste(new.crop((W - off, 0, W, H)), (0, 0))
        push(canvas)
        time.sleep(0.09)
    push(new)


def dimmed(img, factor=0.35):
    return img.point(lambda v: int(v * factor))


def main():
    try:
        open("/sys/class/vtconsole/vtcon1/bind", "w").write("0")
    except Exception:
        pass
    subprocess.run("setterm -cursor off > /dev/tty1 2>&1 || true", shell=True)
    last_key, tick, last_change = "", 0, time.time()
    cur_img = None
    while True:
        try:
            mode, info = get_state()
            if mode != "connected":
                del TEMP_HIST[:]
            key = mode + "|" + str(info.get("ssid", "")) + str(info.get("ip", "")) + str(info.get("stations", 0))
            shift_x = (tick // 60) % 3 - 1
            shift_y = (tick // 120) % 3 - 1
            if key != last_key or (tick % REFRESH_SEC == 0):
                new_img = render(mode, info, shift_x, shift_y)
                if cur_img is not None and key.split("|")[0] != last_key.split("|")[0]:
                    back = mode == "ap_solo" and last_key.split("|")[0] != "ap_solo"
                    slide_push(cur_img, new_img, direction=-1 if back else 1)
                else:
                    push(new_img)
                try:
                    new_img.save("/tmp/forge_display_render.png")
                except Exception:
                    pass
                cur_img = new_img
                last_key = key
                last_change = time.time()
            elif time.time() - last_change > DIM_IDLE_SEC and cur_img is not None:
                push(dimmed(cur_img))
                time.sleep(5)
                tick += 5
                continue
        except Exception as e:
            try:
                print("kiosk loop error: %s" % e, flush=True)
            except Exception:
                pass
            time.sleep(5)
            continue
        time.sleep(1.0)
        tick += 1


FAKE_SHOTS = {
    "ap_solo": ({"fake": True, "stations": 0,
                 "ap": {"ssid": "RTL8189FTV_AP", "password": "tvbox12345", "channel": 6}},),
    "peer": ({"fake": True, "stations": 1,
              "ap": {"ssid": "RTL8189FTV_AP", "password": "tvbox12345", "channel": 6}},),
    "applying": ({"fake": True, "target": "MinhaCasa_5G",
                  "progress": {"phase": "dhcp"}},),
    "applying_assoc": ({"fake": True, "target": "MinhaCasa_5G",
                        "progress": {"phase": "assoc"}},),
    "applying_gateway": ({"fake": True, "target": "MinhaCasa_5G",
                          "progress": {"phase": "gateway"}},),
    "connected": ({"fake": True, "ssid": "MinhaCasa_5G", "ip": "192.168.1.153",
                   "temp": 48.2, "ram": "612 MB / 1.76 GB", "up": "2h 05m"},),
    "failed": ({"fake": True, "ssid": "MinhaCasa_5G"},),
}


def shot(mode, out):
    if mode not in FAKE_SHOTS:
        print("modes: " + " ".join(sorted(FAKE_SHOTS)))
        sys.exit(2)
    info = dict(FAKE_SHOTS[mode][0])
    img = render(mode, info)
    img.save(out)
    print("wrote %s (%s)" % (out, mode))


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--shot":
        shot(sys.argv[2], sys.argv[3])
    else:
        main()
