from app.models import RainLevel
from app.palette import pixel_to_level, PALETTE


def test_exact_palette_colours_match():
    for rgb, level in PALETTE:
        assert pixel_to_level(rgb) == level


def test_transparent_is_none():
    assert pixel_to_level((0, 255, 0, 0)) == RainLevel.NONE  # green but fully transparent


def test_near_colour_snaps_to_nearest():
    green_rgb = next(rgb for rgb, lvl in PALETTE if lvl == RainLevel.MODERATE)
    nudged = (green_rgb[0] + 5, green_rgb[1] - 5, green_rgb[2] + 3)
    assert pixel_to_level(nudged) == RainLevel.MODERATE


def test_far_colour_is_none():
    assert pixel_to_level((123, 45, 200)) == RainLevel.NONE  # not near any echo colour
