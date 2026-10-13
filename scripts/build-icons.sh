#!/bin/sh
# Re-render the PNG icons from public/icons/icon.svg (macOS: QuickLook + sips).
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
qlmanage -t -s 1024 -o "$TMP" public/icons/icon.svg >/dev/null 2>&1
for s in 192 512; do sips -s format png -z $s $s "$TMP/icon.svg.png" --out public/icons/icon-$s.png >/dev/null; done
cp public/icons/icon-512.png public/icons/icon-maskable-512.png
sips -s format png -z 180 180 "$TMP/icon.svg.png" --out public/icons/apple-touch-icon.png >/dev/null
rm -rf "$TMP"
echo "icons rebuilt"
