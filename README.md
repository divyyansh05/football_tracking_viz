# Football Tracking Viz

A full-stack web application for visualising and analysing professional football match tracking data.

## Architecture

The application is built with a decoupled architecture:

- **Backend:** FastAPI (Python) for processing high-frequency (10Hz) tracking data. Handles data parsing, physics computation (velocity, acceleration, speed), caching using Parquet, and serving APIs.
- **Frontend:** React + Vite. Uses Zustand for state management and D3-Delaunay for generating pitch control and Voronoi diagrams. Uses HTML5 Canvas / SVG for pitch rendering.
- **Data Pipeline:**
  1. `match_data.json` provides metadata (teams, players, periods).
  2. `tracking.jsonl` provides raw positional data.
  3. Backend computes kinematics and caches the processed frames as Parquet files for sub-millisecond retrieval.

## Setup Instructions

### Backend

1. Navigate to the `backend` directory.
2. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Place match data in `backend/data/raw/` (e.g., `1_match_data.json` and `1_tracking.jsonl`).
4. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend

1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```

## API Endpoints List

- `GET /api/match/list` - List all available matches.
- `GET /api/match/{match_id}/metadata` - Get match metadata (teams, players, periods).
- `GET /api/match/{match_id}/available-frames` - Get the valid frame range.
- `GET /api/match/{match_id}/frame/{frame_number}` - Get full player and ball positions for a single frame.
- `GET /api/match/{match_id}/frames` - Batch fetch frames for animation playback.
- `GET /api/match/{match_id}/pitch-control/{frame_number}` - Get pitch control heatmap data.
- `GET /api/match/{match_id}/voronoi/{frame_number}` - Get Voronoi territory data.
- `GET /api/match/{match_id}/players/{frame_number}/stats` - Get sorted player physical stats.
- `POST /api/upload/match` - Upload new match data and tracking JSONL files.
