"""
routers/match.py — Match Data Endpoints

Provides:
  GET /api/match/list
  GET /api/match/{match_id}/metadata
  GET /api/match/{match_id}/frame/{frame_number}
  GET /api/match/{match_id}/frames           (batch, for animation)
  GET /api/match/{match_id}/pitch-control/{frame_number}
  GET /api/match/{match_id}/players/{frame_number}/stats
  GET /api/match/{match_id}/available-frames
  GET /api/match/{match_id}/voronoi/{frame_number}
"""

import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from core import data_loader, physics, pitch_control as pc, voronoi_engine
from core.data_loader import resolve_tracking_path
from core.storage import storage_provider
from models import (
    AvailableFramesResponse,
    BallData,
    BatchFramesResponse,
    FrameResponse,
    MatchListResponse,
    MatchMetadata,
    MinimalBallFrame,
    MinimalFrame,
    MinimalPlayerFrame,
    PeriodInfo,
    PitchControlResponse,
    PitchDimensions,
    PlayerFrameData,
    PlayerInfo,
    PlayerStatsResponse,
    PlayerStat,
    TeamInfo,
    VoronoiResponse,
)

logger = logging.getLogger(__name__)

# ─── Directory config ─────────────────────────────────────────────────────────
RAW_DATA_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# ─── Module-level in-process cache ────────────────────────────────────────────
_match_data_cache: dict[int, dict] = {}
_tracking_df_cache: dict[int, pd.DataFrame] = {}
_player_lookup_cache: dict[int, dict] = {}

# ─── Pitch control per-frame cache (FIX 15a) ──────────────────────────────────
_pitch_control_cache: dict[str, dict] = {}

router = APIRouter(prefix="/api/match", tags=["match"])


# ─── ENDPOINT 0: List all matches ─────────────────────────────────────────────
@router.get("/list", response_model=MatchListResponse)
def list_matches() -> MatchListResponse:
    """Scan data/raw/ for all available matches."""
    try:
        matches = []

        if not storage_provider.exists(RAW_DATA_DIR):
            return MatchListResponse(matches=[])

        match_files = storage_provider.list_files(RAW_DATA_DIR, "*_match_data.json")
        for json_file in match_files:
            try:
                # json_file is a Path object from storage_provider
                match_id_str = json_file.stem.replace("_match_data", "")
                match_id = int(match_id_str)

                # Load metadata
                content = storage_provider.read_text(json_file)
                match_data = json.loads(content)

                home_team = match_data.get("home_team", {}).get("name", "Unknown")
                away_team = match_data.get("away_team", {}).get("name", "Unknown")
                date = match_data.get("date_time", "")
                home_score = match_data.get("home_team_score", 0)
                away_score = match_data.get("away_team_score", 0)
                score = f"{home_score}-{away_score}"

                # Check if tracking file exists
                tracking_path = resolve_tracking_path(RAW_DATA_DIR, match_id)
                has_tracking = storage_provider.exists(tracking_path)

                matches.append({
                    "match_id": match_id,
                    "home_team": home_team,
                    "away_team": away_team,
                    "date": date,
                    "score": score,
                    "has_tracking": has_tracking,
                })

            except (ValueError, json.JSONDecodeError, KeyError) as exc:
                logger.warning("Skipping invalid match file %s: %s", json_file, exc)
                continue

        matches.sort(key=lambda m: m["match_id"])
        return MatchListResponse(matches=matches)

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── Resource loader helper ───────────────────────────────────────────────────
def get_match_resources(match_id: int) -> tuple[dict, pd.DataFrame, dict]:
    """Return (match_data, tracking_df, player_lookup) with caching.

    Raises:
        HTTPException(404): if raw files not found
        HTTPException(400): if data parsing fails
        HTTPException(500): for other errors
    """
    try:
        if match_id in _match_data_cache:
            return (
                _match_data_cache[match_id],
                _tracking_df_cache[match_id],
                _player_lookup_cache[match_id],
            )

        json_path = RAW_DATA_DIR / f"{match_id}_match_data.json"
        jsonl_path = resolve_tracking_path(RAW_DATA_DIR, match_id)

        try:
            match_data = data_loader.load_match_metadata(json_path)
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"Match data not found. Upload files first via POST /api/upload/match",
            )

        player_lookup = data_loader.build_player_lookup(match_data)

        try:
            tracking_df = data_loader.load_tracking_data(jsonl_path, PROCESSED_DIR, match_id, match_data)
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"Match tracking data not found. Upload files first via POST /api/upload/match",
            )

        logger.info("Computing physics for match %d…", match_id)
        tracking_df = physics.compute_physics(tracking_df)

        _match_data_cache[match_id] = match_data
        _tracking_df_cache[match_id] = tracking_df
        _player_lookup_cache[match_id] = player_lookup

        return match_data, tracking_df, player_lookup

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 1: Match metadata ───────────────────────────────────────────────
@router.get("/{match_id}/metadata", response_model=MatchMetadata)
def get_match_metadata(match_id: int) -> MatchMetadata:
    """Return structured match metadata including teams, players, periods."""
    try:
        match_data, _df, player_lookup = get_match_resources(match_id)

        home_team = match_data["home_team"]
        away_team = match_data["away_team"]
        home_kit = match_data.get("home_team_kit", {})
        away_kit = match_data.get("away_team_kit", {})
        ce = match_data.get("competition_edition", {})
        stadium = match_data.get("stadium", {})

        players_out = [
            PlayerInfo(
                id=pid,
                name=info["name"],
                last_name=info["last_name"],
                team_id=info["team_id"],
                team=info["team"],
                number=info["number"],
                position=info["position"],
                position_full=info["position_full"],
            )
            for pid, info in player_lookup.items()
        ]

        periods_out = [
            PeriodInfo(
                period=p["period"],
                start_frame=p["start_frame"],
                end_frame=p["end_frame"],
                duration_minutes=p.get("duration_minutes", 0.0),
            )
            for p in match_data.get("match_periods", [])
        ]

        # Get pitch dimensions
        pitch_dims = match_data.get("_pitch_dims", {
            "length": 105.0,
            "width": 68.0,
            "x_offset": 52.5,
            "y_offset": 34.0
        })

        return MatchMetadata(
            match_id=match_data["id"],
            home_team=TeamInfo(
                id=home_team["id"],
                name=home_team["name"],
                short_name=home_team["short_name"],
                jersey_color=home_kit.get("jersey_color", "#FFFFFF"),
                number_color=home_kit.get("number_color", "#000000"),
            ),
            away_team=TeamInfo(
                id=away_team["id"],
                name=away_team["name"],
                short_name=away_team["short_name"],
                jersey_color=away_kit.get("jersey_color", "#FF0000"),
                number_color=away_kit.get("number_color", "#FFFFFF"),
            ),
            home_score=match_data.get("home_team_score", 0),
            away_score=match_data.get("away_team_score", 0),
            date=match_data.get("date_time", ""),
            stadium={
                "name": stadium.get("name", ""),
                "city": stadium.get("city", ""),
            },
            competition=ce.get("competition", {}).get("name", ""),
            season=ce.get("season", {}).get("name", ""),
            round=match_data.get("competition_round", {}).get("name", ""),
            match_periods=periods_out,
            players=players_out,
            pitch=pitch_dims,
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 2: Single frame ─────────────────────────────────────────────────
@router.get("/{match_id}/frame/{frame_number}", response_model=FrameResponse)
def get_frame(match_id: int, frame_number: int) -> FrameResponse:
    """Return full player + ball data for a single frame."""
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)

        frame_dict = data_loader.get_frame_data(tracking_df, frame_number)

        if not frame_dict["players"]:
            raise HTTPException(
                status_code=404, detail=f"No data found for frame {frame_number}"
            )

        time_info = data_loader.frame_to_time(
            frame_number, match_data.get("match_periods", [])
        )

        enriched_players = []
        for row in frame_dict["players"]:
            pid = int(row["player_id"])
            info = player_lookup.get(pid, {})
            enriched_players.append(
                PlayerFrameData(
                    player_id=pid,
                    name=info.get("name", str(pid)),
                    last_name=info.get("last_name", ""),
                    team_id=info.get("team_id", -1),
                    team=info.get("team", "unknown"),
                    x_m=float(row["x_m"]),
                    y_m=float(row["y_m"]),
                    speed=float(row.get("speed", 0.0)),
                    accel=float(row.get("accel", 0.0)),
                    direction_deg=float(row.get("direction_deg", 0.0)),
                    is_detected=bool(row.get("is_detected", True)),
                )
            )

        ball_data = None
        if frame_dict["ball"]:
            ball_data = BallData(
                x_m=frame_dict["ball"]["x_m"],
                y_m=frame_dict["ball"]["y_m"],
            )

        return FrameResponse(
            frame=frame_number,
            time=time_info,
            players=enriched_players,
            ball=ball_data,
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 3: Batch frames (animation) ────────────────────────────────────
@router.get("/{match_id}/frames", response_model=BatchFramesResponse)
def get_frames_batch(
    match_id: int,
    from_frame: int = Query(..., description="Start frame (inclusive)"),
    to_frame: int = Query(..., description="End frame (inclusive)"),
    step: int = Query(1, ge=1, description="Frame step (default 1)"),
) -> BatchFramesResponse:
    """Return a lightweight batch of frames for animation playback.

    Maximum 300 frames per call (30 s at 10 Hz). Each frame carries only
    {player_id, x_m, y_m} per player and {x_m, y_m} for the ball.
    """
    try:
        _match_data, tracking_df, _lookup = get_match_resources(match_id)

        MAX_FRAMES = 300
        requested_frames = list(range(from_frame, to_frame + 1, step))
        if len(requested_frames) > MAX_FRAMES:
            requested_frames = requested_frames[:MAX_FRAMES]

        frames_in_df = tracking_df[
            (tracking_df["frame"] >= from_frame)
            & (tracking_df["frame"] <= to_frame)
        ]

        # Pre-group for efficiency
        grouped = frames_in_df.groupby("frame")

        result_frames = []
        for frame_num in requested_frames:
            if frame_num not in grouped.groups:
                continue

            grp = grouped.get_group(frame_num)
            players_grp = grp[grp["player_id"] != -1]
            ball_grp = grp[grp["player_id"] == -1]

            players_out = [
                MinimalPlayerFrame(
                    player_id=int(r["player_id"]),
                    x_m=float(r["x_m"]),
                    y_m=float(r["y_m"]),
                )
                for _, r in players_grp.iterrows()
            ]

            ball_out = None
            if not ball_grp.empty:
                br = ball_grp.iloc[0]
                ball_out = MinimalBallFrame(x_m=float(br["x_m"]), y_m=float(br["y_m"]))

            result_frames.append(
                MinimalFrame(frame=frame_num, players=players_out, ball=ball_out)
            )

        return BatchFramesResponse(frames=result_frames)

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 4: Pitch control ────────────────────────────────────────────────
@router.get("/{match_id}/pitch-control/{frame_number}", response_model=PitchControlResponse)
def get_pitch_control(match_id: int, frame_number: int) -> PitchControlResponse:
    """Compute and return pitch control heatmap for a single frame."""
    # Check per-frame cache first (FIX 15a)
    cache_key = f"{match_id}_{frame_number}"
    if cache_key in _pitch_control_cache:
        return _pitch_control_cache[cache_key]

    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        home_team_id = match_data["home_team"]["id"]

        frame_dict = data_loader.get_frame_data(tracking_df, frame_number)

        if not frame_dict["players"]:
            raise HTTPException(
                status_code=404, detail=f"No player data for frame {frame_number}"
            )

        # Enrich players with team_id from lookup
        enriched = []
        for row in frame_dict["players"]:
            pid = int(row["player_id"])
            info = player_lookup.get(pid, {})
            enriched.append(
                {
                    "player_id": pid,
                    "x_m": float(row["x_m"]),
                    "y_m": float(row["y_m"]),
                    "team_id": info.get("team_id", -1),
                }
            )

        result = pc.compute_pitch_control(enriched, home_team_id)

        # Compute box control percentages
        import numpy as np
        pitch_length = match_data.get('_pitch_dims', {}).get('length', 105.0)
        pitch_width = match_data.get('_pitch_dims', {}).get('width', 68.0)

        x_arr = np.array(result['x_coords'])
        y_arr = np.array(result['y_coords'])
        grid = np.array(result['home_pct'])

        box_y_min = (pitch_width - 40.32) / 2
        box_y_max = (pitch_width + 40.32) / 2

        # Home attacking box (right side)
        home_box_x_mask = x_arr >= (pitch_length - 16.5)
        home_box_y_mask = (y_arr >= box_y_min) & (y_arr <= box_y_max)

        if np.any(home_box_x_mask) and np.any(home_box_y_mask):
            home_box_cells = grid[np.ix_(home_box_y_mask, home_box_x_mask)]
            home_box_control = float(np.mean(home_box_cells)) * 100
        else:
            home_box_control = 50.0

        # Away attacking box (left side)
        away_box_x_mask = x_arr <= 16.5
        away_box_y_mask = (y_arr >= box_y_min) & (y_arr <= box_y_max)

        if np.any(away_box_x_mask) and np.any(away_box_y_mask):
            away_box_cells = grid[np.ix_(away_box_y_mask, away_box_x_mask)]
            away_box_control = float(np.mean(away_box_cells)) * 100
        else:
            away_box_control = 50.0

        box_control = {
            "home_attacking_box": round(home_box_control, 1),
            "away_attacking_box": round(100 - away_box_control, 1),
            "home_defending_box": round(100 - away_box_control, 1),
            "away_defending_box": round(home_box_control, 1)
        }

        response = PitchControlResponse(
            frame=frame_number,
            home_pct=result["home_pct"],
            x_coords=result["x_coords"],
            y_coords=result["y_coords"],
            summary=result["summary"],
            box_control=box_control
        )

        # Store in cache; evict oldest 100 if cache exceeds 500 entries
        _pitch_control_cache[cache_key] = response
        if len(_pitch_control_cache) > 500:
            oldest_keys = list(_pitch_control_cache.keys())[:100]
            for k in oldest_keys:
                del _pitch_control_cache[k]

        return response

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 5: Player stats at frame ────────────────────────────────────────
@router.get("/{match_id}/players/{frame_number}/stats", response_model=PlayerStatsResponse)
def get_player_stats(match_id: int, frame_number: int) -> PlayerStatsResponse:
    """Return physical stats for all players at the given frame.

    Sorted by speed_kmh descending.
    """
    try:
        _match_data, tracking_df, player_lookup = get_match_resources(match_id)

        frame_df = tracking_df[
            (tracking_df["frame"] == frame_number) & (tracking_df["player_id"] != -1)
        ]

        if frame_df.empty:
            raise HTTPException(
                status_code=404, detail=f"No player data for frame {frame_number}"
            )

        stats = []
        for _, row in frame_df.iterrows():
            pid = int(row["player_id"])
            info = player_lookup.get(pid, {})
            speed_ms = float(row.get("speed", 0.0))
            stats.append(
                PlayerStat(
                    player_id=pid,
                    name=info.get("name", str(pid)),
                    team=info.get("team", "unknown"),
                    speed_kmh=round(speed_ms * 3.6, 2),
                    accel=round(float(row.get("accel", 0.0)), 3),
                    direction_deg=round(float(row.get("direction_deg", 0.0)), 1),
                )
            )

        stats.sort(key=lambda s: s.speed_kmh, reverse=True)
        return PlayerStatsResponse(frame=frame_number, player_stats=stats)

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 6: Available frames ─────────────────────────────────────────────
@router.get("/{match_id}/available-frames", response_model=AvailableFramesResponse)
def get_available_frames(match_id: int) -> AvailableFramesResponse:
    """Return frame range metadata for this match."""
    try:
        match_data, tracking_df, _lookup = get_match_resources(match_id)

        valid_frames = tracking_df[tracking_df["player_id"] != -1]["frame"]
        first_frame = int(valid_frames.min()) if not valid_frames.empty else 20
        last_frame = int(valid_frames.max()) if not valid_frames.empty else 20

        return AvailableFramesResponse(
            total_frames=last_frame - first_frame + 1,
            first_frame=first_frame,
            last_frame=last_frame,
            periods=match_data.get("match_periods", []),
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 7: Voronoi diagram ──────────────────────────────────────────────
@router.get("/{match_id}/voronoi/{frame_number}", response_model=VoronoiResponse)
def get_voronoi(match_id: int, frame_number: int) -> VoronoiResponse:
    """Compute and return Voronoi regions for a single frame."""
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        home_team_id = match_data["home_team"]["id"]

        # Get team colors
        home_kit = match_data.get("home_team_kit", {})
        away_kit = match_data.get("away_team_kit", {})
        home_color = home_kit.get("jersey_color", "#0000FF")
        away_color = away_kit.get("jersey_color", "#FF0000")

        frame_dict = data_loader.get_frame_data(tracking_df, frame_number)

        if not frame_dict["players"]:
            raise HTTPException(
                status_code=404, detail=f"No player data for frame {frame_number}"
            )

        # Enrich players with team_id and name from lookup
        enriched = []
        for row in frame_dict["players"]:
            pid = int(row["player_id"])
            info = player_lookup.get(pid, {})
            enriched.append(
                {
                    "player_id": pid,
                    "name": info.get("name", str(pid)),
                    "x_m": float(row["x_m"]),
                    "y_m": float(row["y_m"]),
                    "team_id": info.get("team_id", -1),
                }
            )

        result = voronoi_engine.compute_voronoi(
            enriched, home_team_id, home_color, away_color
        )

        return VoronoiResponse(
            frame=frame_number,
            regions=result["regions"],
            summary=result["summary"],
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(exc)}")


# ─── ENDPOINT 8: Match status (FIX 15c) ───────────────────────────────────────
@router.get("/{match_id}/status")
def get_match_status(match_id: int):
    """Return readiness status for a match (parquet cache, in-memory, files)."""
    parquet_path = PROCESSED_DIR / f"{match_id}_tracking.parquet"
    match_json = RAW_DATA_DIR / f"{match_id}_match_data.json"
    tracking_jsonl = RAW_DATA_DIR / f"{match_id}_tracking.jsonl"
    tracking_jsonl_alt = RAW_DATA_DIR / f"{match_id}_tracking_data.jsonl"

    has_tracking = tracking_jsonl.exists() or tracking_jsonl_alt.exists()

    return {
        "match_id": match_id,
        "has_match_json": match_json.exists(),
        "has_tracking_jsonl": has_tracking,
        "has_parquet_cache": parquet_path.exists(),
        "is_in_memory": match_id in _tracking_df_cache,
        "status": "ready" if parquet_path.exists() else ("processing" if has_tracking else "missing"),
    }
