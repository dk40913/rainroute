from app.models import GeoBox


def latlng_to_pixel(lat, lng, geo: GeoBox, width, height):
    fx = (lng - geo.left_lon) / (geo.right_lon - geo.left_lon)
    fy = (geo.top_lat - lat) / (geo.top_lat - geo.bottom_lat)
    x = min(width - 1, max(0, int(fx * width)))
    y = min(height - 1, max(0, int(fy * height)))
    return (x, y)
