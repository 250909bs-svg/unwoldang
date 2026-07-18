from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, features


def build_mobile_canvas(source: Image.Image, width: int, height: int) -> Image.Image:
    image = source.convert("RGB")
    target = (width, height)

    background = ImageOps.fit(image, target, method=Image.Resampling.LANCZOS)
    background = background.filter(ImageFilter.GaussianBlur(radius=max(width, height) / 36))
    background = ImageEnhance.Brightness(background).enhance(0.42)
    background = ImageEnhance.Color(background).enhance(0.82)

    foreground = ImageOps.contain(image, target, method=Image.Resampling.LANCZOS)
    left = (width - foreground.width) // 2
    top = (height - foreground.height) // 2
    background.paste(foreground, (left, top))
    return background


def optimize_directory(source_dir: Path, output_dir: Path, width: int, height: int) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    png_files = sorted(source_dir.glob("*.png"))
    if not png_files:
        raise SystemExit(f"No PNG originals found in {source_dir}")

    avif_supported = features.check("avif")
    for source_path in png_files:
        with Image.open(source_path) as source:
            canvas = build_mobile_canvas(source, width, height)
            webp_path = output_dir / f"{source_path.stem}.webp"
            canvas.save(webp_path, "WEBP", quality=86, method=6)

            if avif_supported:
                avif_path = output_dir / f"{source_path.stem}.avif"
                canvas.save(avif_path, "AVIF", quality=70)

            print(
                f"optimized {source_path.name} -> {webp_path.name}"
                + (" + AVIF" if avif_supported else "")
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Optimize MZ love artwork for mobile delivery.")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--width", type=int, default=1080)
    parser.add_argument("--height", type=int, default=1920)
    args = parser.parse_args()
    optimize_directory(args.source, args.output, args.width, args.height)


if __name__ == "__main__":
    main()
