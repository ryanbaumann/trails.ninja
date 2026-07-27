#!/usr/bin/env bash

# scripts/optimize-hairstyles.sh
# Optimizes hairstyle images: converts to WebP, resizes, and organizes.

RAW_DIR="public/images/raw"
OPTIM_DIR="public/images/optimized"

mkdir -p "$OPTIM_DIR/women"
mkdir -p "$OPTIM_DIR/men"

echo "🎨 Optimizing Hairstyle Images..."

# Women
for img in "$RAW_DIR/women"/*.png; do
    name=$(basename "$img" .png)
    echo "  > Optimizing Women: $name"
    sips -s format jpeg --resampleWidth 800 "$img" --out "$OPTIM_DIR/women/$name.jpg" > /dev/null 2>&1
done

# Men
for img in "$RAW_DIR/men"/*.png; do
    name=$(basename "$img" .png)
    echo "  > Optimizing Men: $name"
    sips -s format jpeg --resampleWidth 800 "$img" --out "$OPTIM_DIR/men/$name.jpg" > /dev/null 2>&1
done

echo "✅ Optimization Complete!"
