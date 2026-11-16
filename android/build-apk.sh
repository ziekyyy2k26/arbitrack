#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
DIST_DIR="$ROOT_DIR/dist"
OUT_APK="$ROOT_DIR/arbpulse-android.apk"

SDK_DIR="${ANDROID_HOME:-/opt/android-sdk}"
BUILD_TOOLS="$SDK_DIR/build-tools/34.0.0"
PLATFORM_JAR="$SDK_DIR/platforms/android-34/android.jar"
JAVA_HOME_DIR="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"

export PATH="$JAVA_HOME_DIR/bin:$BUILD_TOOLS:$PATH"

if [ ! -f "$PLATFORM_JAR" ]; then
  echo "Android SDK platform-34 not found at $PLATFORM_JAR" >&2
  exit 1
fi
if [ ! -d "$DIST_DIR" ] || [ ! -f "$DIST_DIR/index.html" ]; then
  echo "dist/ bundle missing; run npm run build first" >&2
  exit 1
fi

WORK="/tmp/arbpulse-apk-build"
rm -rf "$WORK"
mkdir -p "$WORK/gen" "$WORK/obj" "$WORK/res-flat" "$WORK/assets/dist" "$WORK/dex" "$WORK/res"

# Copy resources and generate fallback mipmap PNG icons for API < 26
cp -R "$ANDROID_DIR/res/"* "$WORK/res/"
python3 - <<'PY' "$WORK/res"
import os, struct, zlib, sys, math

res_dir = sys.argv[1]

def write_png(path, size):
    bg = (15, 23, 42, 255)      # #0F172A
    teal = (20, 184, 166, 255)  # #14B8A6
    mint = (52, 211, 153, 255)  # #34D399

    pts = [
        (0.22, 0.57),
        (0.35, 0.57),
        (0.43, 0.33),
        (0.52, 0.67),
        (0.61, 0.43),
        (0.68, 0.52),
        (0.78, 0.52),
    ]
    scaled = [(x * size, y * size) for x, y in pts]
    stroke_r = max(1.4, size * 0.032)
    dot_x, dot_y = scaled[-1]
    dot_r = max(2.0, size * 0.048)

    def dist_to_seg(px, py, ax, ay, bx, by):
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy
        if l2 == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            # Rounded square mask
            r_corner = size * 0.22
            cx = min(max(x + 0.5, r_corner), size - r_corner)
            cy = min(max(y + 0.5, r_corner), size - r_corner)
            if math.hypot((x + 0.5) - cx, (y + 0.5) - cy) > r_corner + 0.5:
                row.extend((0, 0, 0, 0))
                continue

            px, py = x + 0.5, y + 0.5
            if math.hypot(px - dot_x, py - dot_y) <= dot_r:
                row.extend(mint)
                continue

            min_d = 1e9
            for i in range(len(scaled) - 1):
                d = dist_to_seg(px, py, scaled[i][0], scaled[i][1], scaled[i + 1][0], scaled[i + 1][1])
                if d < min_d:
                    min_d = d
            if min_d <= stroke_r:
                row.extend(teal)
            else:
                row.extend(bg)
        rows.append(bytes(row))

    raw = b"".join(rows)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)

for folder, sz in [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192),
]:
    write_png(os.path.join(res_dir, folder, "ic_launcher.png"), sz)
PY

# Copy built web bundle into APK assets/dist
cp -R "$DIST_DIR/"* "$WORK/assets/dist/"

# 1. Compile Android resources with aapt2
aapt2 compile --dir "$WORK/res" -o "$WORK/res-flat/compiled.zip"

# 2. Link resources + assets + manifest into base unaligned APK and generate R.java
aapt2 link \
  -I "$PLATFORM_JAR" \
  --manifest "$ANDROID_DIR/AndroidManifest.xml" \
  -A "$WORK/assets" \
  --java "$WORK/gen" \
  -o "$WORK/unaligned-no-dex.apk" \
  "$WORK/res-flat/compiled.zip"

# 3. Compile Java sources
JAVA_SRCS=$(find "$ANDROID_DIR/src" "$WORK/gen" -name "*.java")
javac -source 1.8 -target 1.8 -bootclasspath "$PLATFORM_JAR" -d "$WORK/obj" $JAVA_SRCS

# 4. Compile bytecode to classes.dex using d8
CLASS_FILES=$(find "$WORK/obj" -name "*.class")
d8 --min-api 24 --lib "$PLATFORM_JAR" --output "$WORK/dex" $CLASS_FILES

# 5. Add classes.dex into the APK
cp "$WORK/unaligned-no-dex.apk" "$WORK/unaligned.apk"
python3 - <<'PY' "$WORK/unaligned.apk" "$WORK/dex/classes.dex"
import zipfile, sys
with zipfile.ZipFile(sys.argv[1], "a", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.write(sys.argv[2], "classes.dex")
PY

# 6. Zipalign APK
zipalign -p -f 4 "$WORK/unaligned.apk" "$WORK/aligned.apk"

# 7. Sign APK with persistent keystore
KEYSTORE="/root/.android/arbpulse-release.keystore"
mkdir -p "$(dirname "$KEYSTORE")"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias arbpulse \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass arbpulse2026 -keypass arbpulse2026 \
    -dname "CN=ArbPulse, OU=Engineering, O=ArbPulse, L=San Francisco, ST=CA, C=US" >/dev/null 2>&1
fi

apksigner sign \
  --ks "$KEYSTORE" \
  --ks-key-alias arbpulse \
  --ks-pass pass:arbpulse2026 \
  --key-pass pass:arbpulse2026 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$OUT_APK" \
  "$WORK/aligned.apk"

apksigner verify --print-certs "$OUT_APK"
ls -lh "$OUT_APK"
