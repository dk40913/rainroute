from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RAINROUTE_")

    cwa_api_key: str = ""
    ors_api_key: str = ""
    nominatim_user_agent: str = "rainroute-dev (set-me@example.com)"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    # api.openrouteservice.org is deprecated and shuts off 2026-08-24;
    # HeiGIT's unified URL keeps the same /v2/directions/... paths under this base.
    ors_base_url: str = "https://api.heigit.org/openrouteservice"
    osrm_base_url: str = "https://router.project-osrm.org"
    routing_backend: str = "ors"  # "ors" | "osrm" (key-less fallback)
    cwa_base_url: str = "https://opendata.cwa.gov.tw"
    radar_cache_ttl_s: int = 600
    sample_interval_m: float = 500.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
