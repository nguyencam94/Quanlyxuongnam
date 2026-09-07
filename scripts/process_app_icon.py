import subprocess
import os

input_img = './src/assets/images/michfarm_pwa_icon_1788809245319.jpg'

# 1. Trim whitespace to get the icon bounding box
subprocess.run(
    f'convert "{input_img}" -fuzz 8% -trim +repage /tmp/trimmed.png',
    shell=True,
    check=True
)

# Get dimensions of trimmed image
dim = subprocess.check_output('identify -format "%w %h" /tmp/trimmed.png', shell=True).decode().strip().split()
w, h = int(dim[0]), int(dim[1])
max_dim = max(w, h)
print(f"Trimmed size: {w}x{h}, target square: {max_dim}x{max_dim}")

# 2. Make square with transparent background
subprocess.run(
    f'convert /tmp/trimmed.png -gravity center -background transparent -extent {max_dim}x{max_dim} /tmp/squared.png',
    shell=True,
    check=True
)

# 3. Create rounded corners mask if needed or transparent corners
# The icon itself has rounded corners. Let's make outside of the rounded squircle transparent:
# Or if it's already a rounded squircle, make the white corners transparent:
subprocess.run(
    'convert /tmp/squared.png -fuzz 15% -transparent white /tmp/transparent.png',
    shell=True,
    check=True
)

# 4. Generate public/pwa-512x512.png
subprocess.run(
    'convert /tmp/squared.png -resize 512x512 public/pwa-512x512.png',
    shell=True,
    check=True
)

# 5. Generate public/pwa-192x192.png
subprocess.run(
    'convert /tmp/squared.png -resize 192x192 public/pwa-192x192.png',
    shell=True,
    check=True
)

# 6. Generate public/apple-touch-icon.png (180x180)
subprocess.run(
    'convert /tmp/squared.png -resize 180x180 public/apple-touch-icon.png',
    shell=True,
    check=True
)

# 7. Generate public/favicon.ico (multisize 16, 32, 48)
subprocess.run(
    'convert /tmp/squared.png -define icon:auto-resize=64,48,32,16 public/favicon.ico',
    shell=True,
    check=True
)

# 8. Generate maskable icon (512x512)
# For maskable icons on Android, we must have a non-transparent background with a 15% safe margin.
# Sample the green color from the icon:
sample_color = subprocess.check_output(
    'convert /tmp/squared.png -crop 10x10+100+100 -resize 1x1 -format "%[hex:u]" info:',
    shell=True
).decode().strip()
bg_hex = f"#{sample_color[:6]}" if sample_color else "#38a127"
print(f"Sampled background color: {bg_hex}")

# Resize icon to 80% (410x410) and center on 512x512 background:
subprocess.run(
    f'convert -size 512x512 "canvas:{bg_hex}" /tmp/bg.png',
    shell=True,
    check=True
)
subprocess.run(
    'convert /tmp/squared.png -resize 410x410 /tmp/icon_safe.png',
    shell=True,
    check=True
)
subprocess.run(
    'composite -gravity center /tmp/icon_safe.png /tmp/bg.png public/pwa-maskable-512x512.png',
    shell=True,
    check=True
)

# Also save an app-icon.png in public for direct in-app UI use (e.g. logo in header & login)
subprocess.run(
    'cp public/pwa-512x512.png public/app-icon.png',
    shell=True,
    check=True
)

print("All icons successfully generated in public/!")
