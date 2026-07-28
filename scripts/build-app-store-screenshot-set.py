#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "app-store-assets" / "simulator-captures"
OUT = ROOT / "app-store-assets" / "app-store-connect"
SOURCE_PHOTOS = ROOT / "app-store-assets" / "source-photos" / "pexels"
SOURCE_ORIGINALS = OUT / "source-originals"

GREEN = (21, 239, 112)
BG = (0, 19, 15)
WHITE = (246, 247, 244)
MUTED = (211, 216, 212)
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"

SCENES = [
    {
        "number": "04",
        "slug": "see-your-progress",
        "capture": CAPTURES / "stats.png",
        "white": "SEE YOUR",
        "green": "PROGRESS",
        "sub": ["Stats, streaks, and", "personal bests."],
        "icon": "chart",
        "angle": -4.0,
        "x": 112,
    },
    {
        "number": "05",
        "slug": "finish-your-projects",
        "capture": CAPTURES / "project-detail.png",
        "white": "FINISH YOUR",
        "green": "PROJECTS",
        "sub": ["Save beta. Track attempts.", "Send it."],
        "icon": "flag",
        "angle": 3.5,
        "x": 104,
    },
    {
        "number": "06",
        "slug": "relive-your-week",
        "capture": CAPTURES / "weekly-recap.png",
        "white": "RELIVE YOUR",
        "green": "WEEK",
        "sub": ["A personal recap,", "made to share."],
        "icon": "spark",
        "angle": -3.0,
        "x": 106,
    },
]

SIZES = {
    "iphone-6.9": (1320, 2868),
    "iphone-6.5": (1284, 2778),
    "iphone-6.3": (1206, 2622),
    "iphone-6.1": (1170, 2532),
    "iphone-5.5": (1242, 2208),
    "ipad-13": (2064, 2752),
}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def background(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height), BG)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            glow = max(0.0, 1.0 - math.hypot((x - width * 0.72) / width, (y - height * 0.39) / height) * 1.8)
            edge = max(0.0, 1.0 - math.hypot((x - width * 0.05) / width, (y - height * 0.83) / height) * 2.4)
            noise = ((x * 17 + y * 29) % 31) / 31.0
            pixels[x, y] = (
                0,
                min(36, int(17 + glow * 17 + edge * 7 + noise * 1.2)),
                min(29, int(13 + glow * 12 + edge * 10 + noise)),
            )
    draw = ImageDraw.Draw(image, "RGBA")
    for seed in range(11):
        cx = int(width * (0.58 + (seed % 4) * 0.12))
        cy = int(height * (0.18 + (seed // 4) * 0.15))
        base = 70 + seed * 19
        points = []
        for i in range(141):
            t = math.tau * i / 140
            wobble = 1 + 0.12 * math.sin(t * 3 + seed) + 0.05 * math.sin(t * 7)
            rx = base * 1.8 * wobble
            ry = base * wobble
            points.append((cx + math.cos(t) * rx, cy + math.sin(t) * ry))
        draw.line(points, fill=(23, 136, 76, 25), width=2)
    draw.arc((-180, height - 590, 420, height + 30), 208, 342, fill=(21, 239, 112, 85), width=4)
    for i in range(8):
        px = 25 + i * 42
        py = height - 255 - int(50 * math.sin(i * 0.7))
        draw.ellipse((px, py, px + 7, py + 7), fill=(21, 239, 112, 135))
    return image


def draw_icon(draw: ImageDraw.ImageDraw, kind: str, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    draw.ellipse(box, outline=GREEN + (230,), width=3)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    if kind == "chart":
        draw.line((cx - 22, cy + 17, cx - 22, cy - 4), fill=GREEN, width=5)
        draw.line((cx, cy + 17, cx, cy - 23), fill=GREEN, width=5)
        draw.line((cx + 22, cy + 17, cx + 22, cy - 12), fill=GREEN, width=5)
        draw.line((cx - 29, cy + 20, cx + 30, cy + 20), fill=GREEN, width=4)
    elif kind == "flag":
        draw.line((cx - 21, cy - 27, cx - 21, cy + 29), fill=GREEN, width=5)
        draw.polygon([(cx - 19, cy - 25), (cx + 28, cy - 14), (cx - 19, cy + 1)], outline=GREEN)
        draw.line((cx - 18, cy - 24, cx + 27, cy - 14, cx - 18, cy), fill=GREEN, width=4)
    else:
        pts = [(cx, cy - 30), (cx + 8, cy - 8), (cx + 30, cy), (cx + 8, cy + 8),
               (cx, cy + 30), (cx - 8, cy + 8), (cx - 30, cy), (cx - 8, cy - 8), (cx, cy - 30)]
        draw.line(pts, fill=GREEN, width=4)


def rounded_capture(path: Path, width: int, radius: int) -> Image.Image:
    capture = Image.open(path).convert("RGB")
    height = round(capture.height * width / capture.width)
    capture = capture.resize((width, height), Image.Resampling.LANCZOS)
    mask = Image.new("L", capture.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    rail = 42
    device = Image.new("RGBA", (width + rail * 2, height + rail * 2), (0, 0, 0, 0))
    border = Image.new("RGBA", device.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)

    # Layered rails mimic the polished titanium/glass construction used by the
    # original three Klimb panels while keeping the simulator pixels untouched.
    shells = [
        ((3, 3, device.width - 4, device.height - 4), radius + 38, (28, 29, 29, 255), (101, 106, 104, 255), 8),
        ((10, 10, device.width - 11, device.height - 11), radius + 30, (13, 14, 14, 255), (230, 232, 231, 235), 5),
        ((17, 17, device.width - 18, device.height - 18), radius + 23, (7, 8, 8, 255), (74, 77, 76, 255), 7),
        ((29, 29, device.width - 30, device.height - 30), radius + 12, (2, 2, 2, 255), (18, 19, 19, 255), 5),
    ]
    for box, rad, fill, outline, stroke in shells:
        bd.rounded_rectangle(box, radius=rad, fill=fill, outline=outline, width=stroke)

    # Hardware details: action/volume buttons on the left and power on the
    # right, with small highlights so the frame reads as metal at thumbnail size.
    left_x = 0
    right_x = device.width - 13
    bd.rounded_rectangle((left_x, 430, 13, 548), radius=6, fill=(85, 89, 88, 255), outline=(209, 211, 210, 210), width=2)
    bd.rounded_rectangle((left_x, 595, 13, 760), radius=6, fill=(67, 71, 70, 255), outline=(181, 184, 183, 210), width=2)
    bd.rounded_rectangle((left_x, 790, 13, 955), radius=6, fill=(67, 71, 70, 255), outline=(181, 184, 183, 210), width=2)
    bd.rounded_rectangle((right_x, 600, device.width - 1, 868), radius=6, fill=(70, 74, 73, 255), outline=(199, 201, 200, 220), width=2)
    bd.line((58, 19, device.width - 90, 19), fill=(255, 255, 255, 120), width=3)
    device.alpha_composite(border)
    screen = Image.new("RGBA", capture.size, (0, 0, 0, 0))
    screen.paste(capture.convert("RGBA"), (0, 0), mask)
    device.alpha_composite(screen, (rail, rail))
    return device


def build_core(scene: dict) -> Image.Image:
    width, height = 1320, 2630
    art = background(width, height).convert("RGBA")
    draw = ImageDraw.Draw(art, "RGBA")
    draw_icon(draw, scene["icon"], (65, 58, 164, 157))
    title_font = font(FONT_BOLD, 86)
    sub_font = font(FONT_REGULAR, 42)
    draw.text((65, 200), scene["white"], font=title_font, fill=WHITE)
    draw.text((65, 292), scene["green"], font=title_font, fill=GREEN)
    sy = 410
    for line in scene["sub"]:
        draw.text((65, sy), line, font=sub_font, fill=MUTED)
        sy += 54
    phone = rounded_capture(scene["capture"], 990, 78)
    shadow = Image.new("RGBA", phone.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 220), (0, 0, phone.width, phone.height), phone.getchannel("A"))
    shadow = shadow.filter(ImageFilter.GaussianBlur(36))
    angle = scene["angle"]
    shadow = shadow.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    phone = phone.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    px = scene["x"]
    py = 650
    art.alpha_composite(shadow, (px + 24, py + 36))
    art.alpha_composite(phone, (px, py))
    return art.convert("RGB")


def fit_with_padding(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    width, height = size
    scale = min(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, BG)
    canvas.paste(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return canvas


def crop_existing_core(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGB")
    # Existing iPhone 6.9 artwork has 119px packaging bars above and below.
    return image.crop((0, 119, image.width, image.height - 119))


def route_photo_tile(path: Path, size: int = 124) -> Image.Image:
    photo = Image.open(path).convert("RGB")
    photo = ImageOps.fit(photo, (size, size), method=Image.Resampling.LANCZOS)
    photo = ImageEnhance.Contrast(photo).enhance(1.05)
    photo = ImageEnhance.Color(photo).enhance(1.03)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (1, 1, size - 2, size - 2),
        radius=18,
        fill=255,
    )
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(photo, (0, 0), mask)
    ImageDraw.Draw(tile).rounded_rectangle(
        (1, 1, size - 2, size - 2),
        radius=18,
        outline=(255, 255, 255, 70),
        width=2,
    )
    return tile


def add_real_route_photos(image: Image.Image) -> Image.Image:
    """Replace the five tiny route thumbnails with real Pexels photography."""
    output = image.convert("RGBA")
    photos = [
        SOURCE_PHOTOS / "bouldering-01.jpg",
        SOURCE_PHOTOS / "bouldering-02.jpg",
        SOURCE_PHOTOS / "bouldering-03.jpg",
        SOURCE_PHOTOS / "bouldering-04.jpg",
        SOURCE_PHOTOS / "bouldering-01.jpg",
    ]
    # Centers follow the slight perspective of the premium phone mockup.
    centers = [
        (402, 1690),
        (411, 1878),
        (422, 2062),
        (433, 2247),
        (446, 2447),
    ]
    for photo_path, center in zip(photos, centers):
        tile = route_photo_tile(photo_path)
        tile = tile.rotate(4.0, resample=Image.Resampling.BICUBIC, expand=True)
        output.alpha_composite(
            tile,
            (center[0] - tile.width // 2, center[1] - tile.height // 2),
        )
    return output.convert("RGB")


def main() -> None:
    core_dir = OUT / "core"
    core_dir.mkdir(parents=True, exist_ok=True)
    new_cores: list[tuple[str, Image.Image]] = []
    for scene in SCENES:
        name = f'{scene["number"]}-{scene["slug"]}.png'
        core = build_core(scene)
        core.save(core_dir / name, quality=98)
        new_cores.append((name, core))

    originals = []
    for name in ("01-log-every-klimb.png", "02-explore-the-world.png", "03-add-your-friends.png"):
        source = SOURCE_ORIGINALS / name.replace(".png", "-base.png")
        if not source.exists():
            source = OUT / "iphone-6.9" / name
        image = Image.open(source).convert("RGB")
        if name == "01-log-every-klimb.png":
            image = add_real_route_photos(image)
        originals.append((name, image.crop((0, 119, image.width, image.height - 119))))

    all_cores = originals + new_cores
    for folder, size in SIZES.items():
        target = OUT / folder
        target.mkdir(parents=True, exist_ok=True)
        for name, core in all_cores:
            fit_with_padding(core, size).save(target / name, quality=98)


if __name__ == "__main__":
    main()
