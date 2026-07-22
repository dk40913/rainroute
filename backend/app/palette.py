from PIL import Image, ImageChops

from app.models import RainLevel

# Calibrated 2026-07-22 against a real O-A0058-003 image. The real product uses
# a CONTINUOUS colour ramp (cyan→blue→green→yellow→orange→red→magenta as dBZ
# rises), so each band gets several anchors; nearest-match within max_dist then
# covers the interpolated colours between them. Background is white/grey (RGB,
# no alpha) and map linework is dark slate blue (55, 74, 135) — all of those sit
# farther than max_dist from every anchor and correctly resolve to NONE.
PALETTE: list[tuple[tuple[int, int, int], RainLevel]] = [
    ((0, 218, 255), RainLevel.LIGHT),      # cyan end of blue band (low dBZ)
    ((0, 160, 255), RainLevel.LIGHT),
    ((0, 91, 255), RainLevel.LIGHT),
    ((0, 0, 255), RainLevel.LIGHT),        # deep blue end of blue band
    ((0, 150, 0), RainLevel.MODERATE),     # green band (real rain)
    ((0, 200, 0), RainLevel.MODERATE),
    ((0, 255, 0), RainLevel.MODERATE),
    ((102, 192, 0), RainLevel.MODERATE),   # yellow-green transition
    ((204, 234, 0), RainLevel.MODERATE),
    ((255, 255, 0), RainLevel.MODERATE),   # yellow
    ((255, 222, 0), RainLevel.MODERATE),
    ((255, 152, 0), RainLevel.HEAVY),      # orange band
    ((255, 96, 0), RainLevel.HEAVY),
    ((255, 0, 0), RainLevel.HEAVY),        # red band
    ((200, 0, 0), RainLevel.HEAVY),
    ((255, 0, 255), RainLevel.HEAVY),      # magenta (extreme)
    ((214, 0, 214), RainLevel.HEAVY),
]


def _dist2(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def strip_non_echo(image: Image.Image) -> Image.Image:
    """Make every pixel that isn't a radar echo colour fully transparent.

    The CWA radar PNG bakes in cartography: white/grey background, black/grey
    coastlines, and dark slate-blue (55, 74, 135) river/boundary linework.
    Echo colours (see PALETTE) are saturated (max-min channel spread >= 30)
    and bright in at least one channel (>= 150); the map linework has enough
    saturation (sat=80) but isn't bright enough (max=135), so it's dropped
    along with the background and line art. Uses only PIL C-speed channel
    ops (no per-pixel Python loops) since the image is 3600x3600 = 13M px.
    """
    rgb = image.convert("RGB")
    r, g, b = rgb.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    sat = ImageChops.subtract(mx, mn)
    sat_mask = sat.point(lambda v: 255 if v >= 30 else 0)
    mx_mask = mx.point(lambda v: 255 if v >= 150 else 0)
    alpha = ImageChops.darker(sat_mask, mx_mask)  # logical AND
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def pixel_to_level(pixel, palette=PALETTE, max_dist=100.0):
    if len(pixel) >= 4 and pixel[3] < 128:
        return RainLevel.NONE
    rgb = tuple(pixel[:3])
    best_level, best_d2 = RainLevel.NONE, max_dist * max_dist
    for colour, level in palette:
        d2 = _dist2(rgb, colour)
        if d2 < best_d2:
            best_level, best_d2 = level, d2
    return best_level
