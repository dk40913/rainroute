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


def test_resample_multi_segment_carry_crossing():
    """Test resampling carry crossing segment boundaries.

    3-point polyline with interior vertex:
    (25.0, 121.0) -> (25.03, 121.0) -> (25.1, 121.0) ≈ 11.1 km total
    Resampled at 1000 m intervals.
    """
    line = [(25.0, 121.0), (25.03, 121.0), (25.1, 121.0)]
    pts = resample_polyline(line, interval_m=1000.0)

    # Endpoints must be included exactly
    assert pts[0] == (25.0, 121.0)
    assert pts[-1] == (25.1, 121.0)

    # Check gap uniformity
    gaps = [haversine_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    # All gaps <= 1100 m
    assert all(g <= 1100 for g in gaps), f"Gaps: {gaps}"
    # Interior gaps >= 900 m (final gap may be shorter)
    assert all(g >= 900 for g in gaps[:-1]), f"Interior gaps: {gaps[:-1]}"


def test_resample_zero_length_interior_segment():
    """Test resampling with zero-length interior segment (duplicate vertex).

    Polyline with duplicate consecutive vertex:
    (25.0, 121.0) -> (25.05, 121.0) -> (25.05, 121.0) -> (25.1, 121.0)
    """
    line = [(25.0, 121.0), (25.05, 121.0), (25.05, 121.0), (25.1, 121.0)]
    pts = resample_polyline(line, interval_m=1000.0)

    # Endpoints must be included exactly
    assert pts[0] == (25.0, 121.0)
    assert pts[-1] == (25.1, 121.0)

    # No duplicate consecutive points in output
    for i in range(len(pts) - 1):
        assert pts[i] != pts[i + 1], f"Duplicate points at index {i}: {pts[i]}"

    # Check gap uniformity
    gaps = [haversine_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    # All gaps <= 1100 m
    assert all(g <= 1100 for g in gaps), f"Gaps: {gaps}"
    # Interior gaps >= 900 m (final gap may be shorter)
    assert all(g >= 900 for g in gaps[:-1]), f"Interior gaps: {gaps[:-1]}"
