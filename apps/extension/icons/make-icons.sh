#!/usr/bin/env bash
# Regenerate the PNG icons from icon.svg.
# MV3 requires raster icons for the `icons` and `action.default_icon` keys
# (SVG is not accepted there), so we rasterize the single source SVG.
#
# Needs one of: rsvg-convert (librsvg), inkscape, or ImageMagick `convert`.
set -euo pipefail
cd "$(dirname "$0")"

for size in 16 32 48 128; do
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w "$size" -h "$size" icon.svg -o "icon-$size.png"
  elif command -v inkscape >/dev/null 2>&1; then
    inkscape icon.svg -w "$size" -h "$size" -o "icon-$size.png"
  elif command -v convert >/dev/null 2>&1; then
    convert -background none -resize "${size}x${size}" icon.svg "icon-$size.png"
  else
    echo "Install librsvg (rsvg-convert), inkscape, or imagemagick to build icons." >&2
    exit 1
  fi
  echo "wrote icon-$size.png"
done
