# Football Tracking Viz & Analytics Platform

A high-performance, full-stack web application for visualising and analysing professional football match tracking data (10 Hz). Built for analysts who need fast, interactive access to tactical, physical, and spatial insights.

---

## Features

### Match View
- **Interactive Playback** — smooth 10 Hz animation of all players and the ball with play/pause/scrub controls
- **Live Stats Panel** — real-time velocity and cumulative distance for every player on the pitch
- **Pitch Control** — probabilistic model showing which team controls which zone at any frame
- **Voronoi Diagrams** — territory control polygons computed per frame using D3-Delaunay

### Player Analytics
- **Heatmaps** — KDE-smoothed spatial distribution per player, filterable by period
- **Distance Timeline** — cumulative work-rate chart across the full match with per-period breakdown
- **Speed Profiles** — velocity distribution bucketed into walking / jogging / running / high-speed / sprint zones

### Team Tactics
- **Convex Hulls** — real-time team shape showing compactness, length, and width
- **Formation Tracker** — dynamic average positions and tactical shape sampled every 5 minutes
- **Pressing Maps** — Gaussian KDE heatmap of where each team wins the ball and applies pressure
- **Centroid Tracker** — "centre of gravity" trail for both teams with distance-between-centroids chart and territory-zone labelling (deep / mid / advanced)

### Match Insights
- **Space Control Timeline** — stacked area chart (always sums to 100 %) showing territory share across the match, with 5-minute momentum blocks and a Voronoi snapshot viewer for any chosen minute
- **Ball Trajectory** — coloured line segments per speed class (SLOW / MEDIUM / FAST / VERY FAST) with direction-change touch markers, animated ball replay, period filter, minute-range presets, and a speed distribution bar
- **Physical Dashboard** — full-squad table with expandable per-player zone bars, team distance and sprint bar charts, and a records banner (top distance, top speed, most sprints)

---

## Technology Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async Python API
- [Pandas](https://pandas.pydata.org/) + [PyArrow](https://arrow.apache.org/docs/python/index.html) — Parquet caching for sub-millisecond repeated reads
- [Shapely](https://shapely.readthedocs.io/) + [SciPy](https://scipy.org/) — convex hulls, spatial geometry
- [scikit-learn](https://scikit-learn.org/) — Gaussian KDE for pressing heatmaps
- [NumPy](https://numpy.org/) — frame-level distance / speed computations

**Frontend**
- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Zustand](https://docs.pmnd.rs/zustand/) — global playback state
- [D3-Delaunay](https://github.com/d3/d3-delaunay) — Voronoi spatial math
- [Recharts](https://recharts.org/) — timeline and distribution charts
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling

---

## Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy the environment template:

```bash
cp .env.example .env
```

The default `.env` sets `DATA_DIR=data`, which points to `backend/data/`. No changes needed unless you want a custom data path.

### 2. Place Match Data

Put your raw match files in `backend/data/raw/` using the naming convention:

```
backend/data/raw/
  {match_id}_match_data.json      # Match metadata (teams, players, periods)
  {match_id}_tracking.jsonl       # 10 Hz tracking samples (one JSON object per line)
```

For example, match ID 1:
```
backend/data/raw/1_match_data.json
backend/data/raw/1_tracking.jsonl
```

The backend auto-converts `.jsonl` files to Parquet on first load and caches them in `backend/data/processed/` for fast subsequent reads.

### 3. Start the Backend

```bash
uvicorn main:app --reload
```

API available at `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:5173`.

### 5. Upload a Match (optional)

You can also upload match files through the UI or via curl:

```bash
curl -X POST http://localhost:8000/api/upload/match \
  -F "match_file=@1_match_data.json" \
  -F "tracking_file=@1_tracking.jsonl"
```

---

## API Reference

### Match

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| GET | `/api/match/list` | List all available matches |
| GET | `/api/match/{id}/metadata` | Teams, players, periods, frame count |
| GET | `/api/match/{id}/frame/{n}` | Full positional data for a single frame |
| GET | `/api/match/{id}/frames?start=&end=` | Batch frame fetch for a range |
| GET | `/api/match/{id}/available-frames` | List of frame numbers that exist in the data |
| GET | `/api/match/{id}/pitch-control/{n}` | Pitch control grid for frame n |
| GET | `/api/match/{id}/voronoi/{n}` | Voronoi regions for frame n |
| GET | `/api/match/{id}/players/{n}/stats` | Per-player velocity and distance at frame n |

### Analytics

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| GET | `/api/analytics/{id}/heatmap/{player_id}` | KDE heatmap grid for a player (filterable by period) |
| GET | `/api/analytics/{id}/distance` | Cumulative distance timeline for all players |
| GET | `/api/analytics/{id}/speed/{player_id}` | Speed profile and zone distribution for a player |
| GET | `/api/analytics/{id}/convex-hull/{n}` | Convex hull polygon for both teams at frame n |
| GET | `/api/analytics/{id}/convex-hull-timeline` | Sampled hull metrics (area, length, width) over time |
| GET | `/api/analytics/{id}/formation` | Average positions sampled at 5-minute intervals |
| GET | `/api/analytics/{id}/pressing` | Gaussian KDE pressing heatmap per team |
| GET | `/api/analytics/{id}/centroid` | Centroid timeline with rolling smooth and territory zones |
| GET | `/api/analytics/{id}/space-control-timeline` | Frame-sampled territory share + momentum blocks |
| GET | `/api/analytics/{id}/ball-trajectory` | Ball path with speed classification and touch events |
| GET | `/api/analytics/{id}/physical-summary` | Per-player zone distances, sprint counts, top speeds |

### Upload

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| POST | `/api/upload/match` | Upload and process a new match (`match_file` + `tracking_file` form fields) |

---

## Data Format

**`{id}_match_data.json`** — top-level object with:
- `homeTeam` / `awayTeam` — team name and player list (id, name, position, shirt number)
- `periods` — start/end frame for each period

**`{id}_tracking.jsonl`** — one JSON object per line, each frame contains:
```json
{
  "frame": 1,
  "period": 1,
  "players": [
    { "playerId": 1, "team": "home", "x": 52.3, "y": 34.1, "speed": 2.4 }
  ],
  "ball": { "x": 60.0, "y": 40.0 }
}
```
Coordinates are in metres. Pitch origin is the centre circle. x runs along the length (±52.5 m), y along the width (±34 m).

---

## License
MIT
