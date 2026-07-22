import math

_EARTH_R = 6_371_000.0  # metres


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_R * math.asin(math.sqrt(h))


def _interpolate(a, b, frac):
    return (a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac)


def resample_polyline(polyline, interval_m):
    if len(polyline) <= 1:
        return list(polyline)

    out = [polyline[0]]
    carry = 0.0  # distance already covered since last emitted point
    for seg_start, seg_end in zip(polyline, polyline[1:]):
        seg_len = haversine_m(seg_start, seg_end)
        if seg_len == 0:
            continue
        dist_into = interval_m - carry
        while dist_into < seg_len:
            out.append(_interpolate(seg_start, seg_end, dist_into / seg_len))
            dist_into += interval_m
        carry = seg_len - (dist_into - interval_m)
    if out[-1] != polyline[-1]:
        out.append(polyline[-1])
    return out
