import math
from app.geometry import haversine_m, resample_polyline


def test_haversine_known_distance():
    # ~1 deg latitude ≈ 111 km
    d = haversine_m((25.0, 121.0), (26.0, 121.0))
    assert 110_000 < d < 112_000


def test_haversine_zero():
    assert haversine_m((25.0, 121.0), (25.0, 121.0)) == 0.0


def test_resample_includes_endpoints():
    line = [(25.0, 121.0), (25.1, 121.0)]  # ~11.1 km north
    pts = resample_polyline(line, interval_m=1000.0)
    assert pts[0] == (25.0, 121.0)
    assert pts[-1] == (25.1, 121.0)
    # ~11.1 km at 1 km spacing -> ~12 points
    assert 10 <= len(pts) <= 14


def test_resample_spacing_roughly_uniform():
    line = [(25.0, 121.0), (25.1, 121.0)]
    pts = resample_polyline(line, interval_m=1000.0)
    gaps = [haversine_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    # every interior gap is close to 1000 m (last one may be shorter)
    assert all(g <= 1100 for g in gaps)


def test_resample_edge_cases():
    assert resample_polyline([], 500.0) == []
    assert resample_polyline([(25.0, 121.0)], 500.0) == [(25.0, 121.0)]
