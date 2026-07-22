from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RAINROUTE_")

    cwa_api_key: str = ""
    ors_api_key: str = ""
    nominatim_user_agent: str = "rainroute-dev (set-me@example.com)"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    ors_base_url: str = "https://api.openrouteservice.org"
    radar_cache_ttl_s: int = 600
    sample_interval_m: float = 500.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
