# RainRoute Backend

FastAPI service: geocode → route → sample CWA radar → "wear a raincoat?" verdict.

## Setup
```bash
cd backend
uv sync --extra dev
cp .env.example .env   # then fill in RAINROUTE_CWA_API_KEY and RAINROUTE_ORS_API_KEY
```
Get keys: CWA https://opendata.cwa.gov.tw/ (free register), OpenRouteService https://openrouteservice.org/dev (free).

## Run
```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Test
```bash
uv run pytest -v
```

## Endpoints
- `GET /health`
- `POST /geocode` `{ "query": "台北車站" }`
- `POST /route` `{ "origin": {lat,lng}, "destination": {lat,lng} }`
- `POST /rain` `{ "polyline": [[lat,lng], ...] }`
- `GET /radar.png` — current radar overlay image

## Deploy on the NUC (Phase 1) + remote access
1. Run uvicorn on the NUC bound to `0.0.0.0:8000` (a systemd unit or `tmux` is fine).
2. Install Tailscale on the NUC and on your phone; log both into the same tailnet.
3. The phone reaches the backend at `http://<NUC-tailscale-ip>:8000` from anywhere.
4. Set the app's `BACKEND_BASE_URL` to that address.

## Migrating to the cloud later (Phase A)
Nothing in the code is host-specific. Deploy the same app to Render/Railway/Fly/Cloud Run,
set the same `RAINROUTE_*` env vars, and point `BACKEND_BASE_URL` at the new URL.
