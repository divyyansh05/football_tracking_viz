# Football Tracking Analytics — Backend

FastAPI backend for real-time football tracking data visualization.

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

Server runs at `http://localhost:8000`

Interactive API docs: `http://localhost:8000/docs`

## Data Files

Place match files in `data/raw/`:
- `{match_id}_match_data.json` — Match metadata, teams, players, periods
- `{match_id}_tracking.jsonl` — Frame-by-frame tracking data (JSONL format)

Alternatively, upload files via `POST /api/upload/match`

## First Run

First request to any match endpoint will:
1. Parse the JSONL file (~20-30 seconds for a full match)
2. Compute physics (speed, acceleration, direction)
3. Cache to parquet in `data/processed/`

Subsequent requests are instant (reads from parquet cache).

## Endpoints

### System

- **GET** `/health`
  - Health check
  - Returns: `{"status": "healthy"}`

- **GET** `/`
  - Root endpoint
  - Returns: API info + docs link

---

### Match Discovery

- **GET** `/api/match/list`
  - List all available matches
  - Scans `data/raw/` for match files
  - Returns: Array of matches with metadata summary

  **Response:**
  ```json
  {
    "matches": [
      {
        "match_id": 3788741,
        "home_team": "FC Barcelona",
        "away_team": "Real Madrid",
        "date": "2023-03-19T20:00:00",
        "score": "2-1",
        "has_tracking": true
      }
    ]
  }
  ```

---

### Match Metadata

- **GET** `/api/match/{match_id}/metadata`
  - Full match metadata including teams, players, periods
  - Returns: Teams, scores, players, jersey colors, periods

  **Response:**
  ```json
  {
    "match_id": 3788741,
    "home_team": { "id": 217, "name": "FC Barcelona", ... },
    "away_team": { "id": 218, "name": "Real Madrid", ... },
    "home_score": 2,
    "away_score": 1,
    "date": "2023-03-19T20:00:00",
    "stadium": { "name": "Camp Nou", "city": "Barcelona" },
    "match_periods": [...],
    "players": [...]
  }
  ```

---

### Frame Data

- **GET** `/api/match/{match_id}/frame/{frame_number}`
  - Full player + ball data for a single frame
  - Includes physics: speed, acceleration, direction
  - Returns: Players, ball, time info

  **Response:**
  ```json
  {
    "frame": 6020,
    "time": { "period": 1, "minutes": 10, "seconds": 2, ... },
    "players": [
      {
        "player_id": 5503,
        "name": "Lionel Messi",
        "team": "home",
        "x_m": 65.2,
        "y_m": 34.1,
        "speed": 5.3,
        "accel": 0.8,
        "direction_deg": 45.2,
        "is_detected": true
      }
    ],
    "ball": { "x_m": 52.5, "y_m": 34.0 }
  }
  ```

- **GET** `/api/match/{match_id}/frames?from_frame={n}&to_frame={m}&step={s}`
  - Lightweight batch frames for animation
  - Max 300 frames per call
  - Only returns `{player_id, x_m, y_m}` per player

  **Response:**
  ```json
  {
    "frames": [
      {
        "frame": 6020,
        "players": [{ "player_id": 5503, "x_m": 65.2, "y_m": 34.1 }],
        "ball": { "x_m": 52.5, "y_m": 34.0 }
      }
    ]
  }
  ```

---

### Analysis Endpoints

- **GET** `/api/match/{match_id}/pitch-control/{frame_number}`
  - Pitch control heatmap for a frame
  - Returns: 2D grid of home team control percentage

  **Response:**
  ```json
  {
    "frame": 6020,
    "home_pct": [[0.95, 0.87, ...], ...],
    "x_coords": [0, 5, 10, ...],
    "y_coords": [0, 4, 8, ...],
    "summary": { "home_avg": 0.52, "away_avg": 0.48 }
  }
  ```

- **GET** `/api/match/{match_id}/voronoi/{frame_number}`
  - Voronoi diagram (space control regions) for a frame
  - Clipped to pitch bounds
  - Returns: Polygons per player + team area summary

  **Response:**
  ```json
  {
    "frame": 6020,
    "regions": [
      {
        "player_id": 5503,
        "name": "Lionel Messi",
        "team": "home",
        "color": "#0000FF",
        "polygon": [[65.2, 34.1], [70.3, 28.4], ...],
        "area_m2": 125.3
      }
    ],
    "summary": {
      "home_area": 3570.0,
      "away_area": 3570.0,
      "home_pct": 50.0,
      "away_pct": 50.0
    }
  }
  ```

- **GET** `/api/match/{match_id}/players/{frame_number}/stats`
  - Physical stats for all players at a frame
  - Sorted by speed (fastest first)

  **Response:**
  ```json
  {
    "frame": 6020,
    "player_stats": [
      {
        "player_id": 5503,
        "name": "Lionel Messi",
        "team": "home",
        "speed_kmh": 19.2,
        "accel": 2.1,
        "direction_deg": 45.2
      }
    ]
  }
  ```

- **GET** `/api/match/{match_id}/available-frames`
  - Frame range metadata
  - Returns: First/last frame, total count, periods

  **Response:**
  ```json
  {
    "total_frames": 57600,
    "first_frame": 20,
    "last_frame": 57619,
    "periods": [...]
  }
  ```

---

### Upload

- **POST** `/api/upload/match`
  - Upload match files
  - Form fields: `match_json` (file), `tracking_jsonl` (file)
  - Validates file types (.json, .jsonl)
  - Saves to `data/raw/`, clears cache

  **Response:**
  ```json
  {
    "match_id": 3788741,
    "status": "uploaded",
    "message": "Files saved successfully..."
  }
  ```

---

## Testing

Run the test suite:

```bash
python test_api.py
```

Server must be running on `http://localhost:8000`

Tests all endpoints and reports PASS/FAIL.

---

## Architecture

```
backend/
├── main.py              FastAPI app, CORS, routers
├── models.py            Pydantic response models
├── requirements.txt
├── routers/
│   ├── match.py         Match data endpoints
│   └── upload.py        File upload endpoint
├── core/
│   ├── data_loader.py   JSONL parsing, parquet caching
│   ├── physics.py       Speed/acceleration computation
│   ├── pitch_control.py Pitch control heatmap
│   └── voronoi_engine.py Voronoi diagram computation
└── data/
    ├── raw/             Uploaded match files
    └── processed/       Parquet caches
```

---

## Coordinate System

- Pitch dimensions: 105m × 68m
- Origin: Center of pitch
- Raw coordinates: `[-52.5, 52.5] × [-34, 34]`
- Transformed coordinates: `[0, 105] × [0, 68]`
- Transform: `x_pitch = x_raw + 52.5`, `y_pitch = y_raw + 34`

---

## Error Handling

All endpoints return structured errors:

- **404**: Match data not found → Upload files via `/api/upload/match`
- **400**: Invalid request (bad frame number, parsing errors)
- **500**: Internal server error

---

## Performance Notes

- First match request: ~20-30s (JSONL parsing + physics)
- Cached requests: <100ms (parquet read)
- Batch frames: Optimized for animation (minimal payload)
- Pitch control: ~200ms per frame (on-demand computation)
- Voronoi: ~100ms per frame (scipy Voronoi + shapely clipping)

---

## Development

Install dev dependencies:

```bash
pip install -r requirements.txt
```

Run with auto-reload:

```bash
uvicorn main:app --reload
```

Access interactive docs:

```
http://localhost:8000/docs
```
