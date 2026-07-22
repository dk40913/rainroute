from app.models import GeoBox
from app.pixel import latlng_to_pixel

GEO = GeoBox(left_lon=115.0, right_lon=126.5, top_lat=29.25, bottom_lat=17.75)


def test_top_left_corner():
    assert latlng_to_pixel(29.25, 115.0, GEO, 3600, 3600) == (0, 0)


def test_bottom_right_corner():
    x, y = latlng_to_pixel(17.75, 126.5, GEO, 3600, 3600)
    assert x == 3599 and y == 3599  # clamped to width-1 / height-1


def test_centre():
    x, y = latlng_to_pixel((29.25 + 17.75) / 2, (115.0 + 126.5) / 2, GEO, 3600, 3600)
    assert 1795 <= x <= 1805 and 1795 <= y <= 1805


def test_out_of_bounds_clamped():
    assert latlng_to_pixel(90.0, 0.0, GEO, 3600, 3600) == (0, 0)
