import os
import sys
import time
import socket
import subprocess
import math
from PIL import Image, ImageDraw, ImageFont

FB_DEVICE = '/dev/fb0'
WIDTH = 1920
HEIGHT = 1080
PIXEL_SHIFT_MAX = 2
PIXEL_SHIFT_INTERVAL = 30 # seconds

def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None

def get_cpu_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp = float(f.read().strip()) / 1000.0
            return temp
    except Exception:
        return 0.0

def get_ram_usage():
    try:
        with open("/proc/meminfo", "r") as f:
            lines = f.readlines()
            total = 0
            free = 0
            for line in lines:
                if line.startswith("MemTotal:"):
                    total = int(line.split()[1])
                elif line.startswith("MemAvailable:"):
                    free = int(line.split()[1])
            if total > 0:
                return (total - free) / total * 100
    except Exception:
        pass
    return 0.0

def is_ap_mode():
    try:
        out = subprocess.check_output(["iw", "dev", "wlan0", "info"]).decode("utf-8")
        if "type AP" in out:
            return True
    except Exception:
        pass
    return False

def generate_qr(data):
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(data)
        qr.make(fit=True)
        return qr.make_image(fill_color="black", back_color="white")
    except ImportError:
        out = f"/tmp/qr_{abs(hash(data)) % 99999}.png"
        subprocess.run(["qrencode", "-s", "10", "-m", "4", "-o", out, data], check=True)
        return Image.open(out).convert("RGBA")

def main():
    if not os.path.exists(FB_DEVICE):
        sys.stderr.write(f"Framebuffer device {FB_DEVICE} not found. Skipping.\n")
        sys.exit(1)
    
    fb = open(FB_DEVICE, "wb")
    start_time = time.time()
    
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except Exception:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()
        
    while True:
        try:
            current_time = time.time()
            shift_cycle = int((current_time - start_time) / PIXEL_SHIFT_INTERVAL)
            shift_x = int(math.sin(shift_cycle) * PIXEL_SHIFT_MAX)
            shift_y = int(math.cos(shift_cycle) * PIXEL_SHIFT_MAX)
            
            img = Image.new('RGBA', (WIDTH, HEIGHT), (20, 20, 20, 255))
            draw = ImageDraw.Draw(img)
            
            ip = get_ip_address()
            ap = is_ap_mode()
            
            qr_data = "WIFI:S:MultiForge-Setup-E10;T:WPA;P:forgehub;;" if ap else f"http://{ip if ip else '192.168.4.1'}:8080"
            qr_img = generate_qr(qr_data)
            qr_w, qr_h = qr_img.size
            
            qr_x = (WIDTH - qr_w) // 2 + shift_x
            qr_y = (HEIGHT - qr_h) // 2 + shift_y
            img.paste(qr_img, (qr_x, qr_y))
            
            draw.text((WIDTH//2 + shift_x, qr_y - 60), "ForgeHub Active", font=font, fill=(255, 255, 255, 255), anchor="ms")
            if ap:
                draw.text((WIDTH//2 + shift_x, qr_y + qr_h + 20), "AP Mode - Scan to Connect", font=small_font, fill=(200, 200, 200, 255), anchor="ma")
            else:
                draw.text((WIDTH//2 + shift_x, qr_y + qr_h + 20), f"Dashboard: http://{ip}:8080", font=small_font, fill=(200, 200, 200, 255), anchor="ma")
                
            temp = get_cpu_temp()
            ram = get_ram_usage()
            footer_text = f"CPU Temp: {temp:.1f}°C  |  RAM Usage: {ram:.1f}%  |  IP: {ip if ip else 'Disconnected'}"
            draw.text((20 + shift_x, HEIGHT - 50 + shift_y), footer_text, font=small_font, fill=(150, 150, 150, 255))
            
            # Simple ARGB byte conversion for framebuffer
            b, g, r, a = img.split()
            fb_img = Image.merge("RGBA", (b, g, r, a))
            fb.seek(0)
            fb.write(fb_img.tobytes())
            fb.flush()
        except Exception as e:
            sys.stderr.write(f"Error drawing to framebuffer: {e}\n")
        time.sleep(1)

if __name__ == "__main__":
    main()
