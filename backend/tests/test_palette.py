from PIL import Image

from app.models import RainLevel
from app.palette import pixel_to_level, strip_non_echo, PALETTE


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


def test_all_palette_anchors_pass_the_echo_mask():
    for rgb, _level in PALETTE:
        mx, mn = max(rgb), min(rgb)
        sat = mx - mn
        assert sat >= 30 and mx >= 150, f"{rgb} fails echo mask (sat={sat}, mx={mx})"


def test_strip_non_echo_keeps_only_echo_pixels():
    non_echo = {
        "white": (255, 255, 255),
        "grey": (229, 229, 229),
        "black": (0, 0, 0),
        "slate": (55, 74, 135),
    }
    echo = {
        "light": (0, 160, 255),
        "moderate": (0, 255, 0),
        "heavy": (255, 0, 0),
    }
    colours = {**non_echo, **echo}
    names = list(colours)
    img = Image.new("RGB", (len(names), 1))
    for x, name in enumerate(names):
        img.putpixel((x, 0), colours[name])

    out = strip_non_echo(img)
    assert out.mode == "RGBA"

    for x, name in enumerate(names):
        pixel = out.getpixel((x, 0))
        if name in non_echo:
            assert pixel[3] == 0, f"{name} should be transparent, got {pixel}"
        else:
            assert pixel[3] == 255, f"{name} should be opaque, got {pixel}"
            assert pixel[:3] == colours[name]
