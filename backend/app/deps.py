from functools import lru_cache

from app.config import get_settings
from app.radar import RadarClient


@lru_cache
def get_radar_client() -> RadarClient:
    return RadarClient(get_settings())
