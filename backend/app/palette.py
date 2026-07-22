from app.models import RainLevel

# Approximate CWA / QPESUMS radar reflectivity (dBZ) echo colours mapped to a
# coarse rain level. These are STARTING values — the implementer MUST calibrate
# against a real O-A0058 image (sample known pixels, compare to the legend) and
# adjust. Tests use this table as the source of truth, so they stay valid after
# recalibration as long as the structure is kept.
PALETTE: list[tuple[tuple[int, int, int], RainLevel]] = [
    ((0, 236, 236), RainLevel.LIGHT),      # ~15 dBZ cyan
    ((0, 160, 255), RainLevel.LIGHT),      # ~20 dBZ blue
    ((0, 255, 0), RainLevel.MODERATE),     # ~30 dBZ green
    ((255, 255, 0), RainLevel.MODERATE),   # ~35 dBZ yellow
    ((255, 144, 0), RainLevel.HEAVY),      # ~45 dBZ orange
    ((255, 0, 0), RainLevel.HEAVY),        # ~50 dBZ red
    ((214, 0, 214), RainLevel.HEAVY),      # ~60 dBZ magenta
]


def _dist2(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


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
