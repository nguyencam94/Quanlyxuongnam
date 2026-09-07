import zlib
import struct
import math
import os

def make_png(width, height, get_pixel):
    raw_rows = []
    for y in range(height):
        row = bytearray(b'\x00') # filter type 0
        for x in range(width):
            r, g, b, a = get_pixel(x, y, width, height)
            row.extend((r, g, b, a))
        raw_rows.append(bytes(row))
    
    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data, level=9)
    
    def chunk(chunk_type, data):
        length = struct.pack('>I', len(data))
        crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return length + chunk_type + data + crc

    png_data = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png_data += chunk(b'IHDR', ihdr_data)
    png_data += chunk(b'IDAT', compressed)
    png_data += chunk(b'IEND', b'')
    return png_data

def render_icon(x, y, w, h, is_maskable=False):
    # Normalized coordinates 0..1
    nx = x / (w - 1)
    ny = y / (h - 1)
    
    # Indigo gradient background: (79, 70, 229) to (55, 48, 163)
    bg_r = int(79 * (1 - ny) + 55 * ny)
    bg_g = int(70 * (1 - ny) + 48 * ny)
    bg_b = int(229 * (1 - ny) + 163 * ny)
    
    # Distance from center for rounded rect (if not maskable)
    cx, cy = 0.5, 0.5
    
    # Check rounded rect boundary if not maskable
    if not is_maskable:
        corner_r = 0.22
        dx = abs(nx - cx)
        dy = abs(ny - cy)
        rx = max(0.0, dx - (0.5 - corner_r))
        ry = max(0.0, dy - (0.5 - corner_r))
        dist_sq = rx*rx + ry*ry
        if dist_sq > corner_r * corner_r:
            # Outside rounded corner
            return (0, 0, 0, 0)

    # Scale factor for safe zone if maskable (80% scale centered)
    scale = 0.72 if is_maskable else 0.86
    # Centered normalized coord
    snx = (nx - cx) / scale + 0.5
    sny = (ny - cy) / scale + 0.5

    # Check Mushroom Cap: ellipse / parabolic arc
    # Cap top at sny ~ 0.22, bottom at sny ~ 0.52
    cap_cx, cap_cy = 0.5, 0.40
    cap_rx, cap_ry = 0.28, 0.20
    
    # Stem: sny from 0.48 to 0.78, snx around 0.5
    stem_w = 0.10 + 0.04 * (sny - 0.48)
    in_stem = (0.48 <= sny <= 0.78) and (abs(snx - 0.5) <= stem_w)
    
    # Cap shape: top half of ellipse
    dx_cap = (snx - cap_cx) / cap_rx
    dy_cap = (sny - cap_cy) / cap_ry
    in_cap = (dx_cap*dx_cap + dy_cap*dy_cap <= 1.0) and (sny <= 0.53)

    # Grass accent: sny 0.76 to 0.82
    in_grass = (0.76 <= sny <= 0.81) and (abs(snx - 0.5) <= 0.22)
    
    # Sprout leaf on top: snx 0.5..0.58, sny 0.14..0.22
    leaf_dx = (snx - 0.54)
    leaf_dy = (sny - 0.18)
    in_leaf = (leaf_dx*leaf_dx + leaf_dy*leaf_dy <= 0.04*0.04)

    # Dots on cap:
    dots = [
        (0.42, 0.35, 0.04),
        (0.58, 0.34, 0.045),
        (0.50, 0.44, 0.035),
        (0.33, 0.46, 0.025),
        (0.67, 0.45, 0.028)
    ]
    in_dot = False
    for dot_x, dot_y, dot_r in dots:
        if (snx - dot_x)**2 + (sny - dot_y)**2 <= dot_r**2:
            in_dot = True
            break

    if in_leaf:
        return (52, 211, 153, 255) # emerald sprout leaf
    elif in_dot and in_cap:
        return (79, 70, 229, 255) # indigo dot on cap
    elif in_cap:
        # Cap white gradient
        shade = int(255 - 25 * max(0.0, sny - 0.22))
        return (shade, shade, shade, 255)
    elif in_grass:
        return (16, 185, 129, 255) # emerald grass base
    elif in_stem:
        # Stem off-white
        stem_shade = int(245 - 20 * (sny - 0.48))
        return (stem_shade, stem_shade, stem_shade, 255)
    else:
        return (bg_r, bg_g, bg_b, 255)

os.makedirs('public', exist_ok=True)

# 192x192
png_192 = make_png(192, 192, lambda x, y, w, h: render_icon(x, y, w, h, is_maskable=False))
with open('public/pwa-192x192.png', 'wb') as f:
    f.write(png_192)
print("Created public/pwa-192x192.png")

# 512x512
png_512 = make_png(512, 512, lambda x, y, w, h: render_icon(x, y, w, h, is_maskable=False))
with open('public/pwa-512x512.png', 'wb') as f:
    f.write(png_512)
print("Created public/pwa-512x512.png")

# 512x512 Maskable (full bleed background with 15% inner safe zone)
png_maskable = make_png(512, 512, lambda x, y, w, h: render_icon(x, y, w, h, is_maskable=True))
with open('public/pwa-maskable-512x512.png', 'wb') as f:
    f.write(png_maskable)
print("Created public/pwa-maskable-512x512.png")

# 180x180 Apple Touch Icon
png_apple = make_png(180, 180, lambda x, y, w, h: render_icon(x, y, w, h, is_maskable=False))
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(png_apple)
print("Created public/apple-touch-icon.png")

# Favicon: copy 192 or write 32x32 png / ico
png_favicon = make_png(48, 48, lambda x, y, w, h: render_icon(x, y, w, h, is_maskable=False))
with open('public/favicon.ico', 'wb') as f:
    f.write(png_favicon)
print("Created public/favicon.ico")
