"""
data_loader.py — Football Tracking Data Loading Utilities

Handles:
  - Match metadata (match_data.json)
  - Player lookup table from metadata
  - Streaming JSONL tracking data with parquet caching
  - Frame ↔ time conversion helpers
"""

import json
import logging
import io
from pathlib import Path

import numpy as np
import pandas as pd

from core.storage import storage_provider

logger = logging.getLogger(__name__)

# ─── Pitch constants ──────────────────────────────────────────────────────────
PITCH_WIDTH: float = 105.0
PITCH_HEIGHT: float = 68.0
X_OFFSET: float = 52.5
Y_OFFSET: float = 34.0
FPS: int = 10


# ─── Function 1 ───────────────────────────────────────────────────────────────
def load_match_metadata(json_path: Path) -> dict:
    """Load and return raw match_data.json as a dict.

    Raises:
        FileNotFoundError: if the file does not exist at json_path.
    """
    if not storage_provider.exists(json_path):
        raise FileNotFoundError(
            f"Match metadata file not found: {json_path}. "
            "Please upload match_data.json via POST /api/upload/match."
        )
    
    content = storage_provider.read_text(json_path)
    data = json.loads(content)

    # Extract pitch dimensions (use defaults if not present)
    pitch_length = data.get('pitch_length', 105.0)
    pitch_width = data.get('pitch_width', 68.0)

    # Store in metadata for later use
    data['_pitch_dims'] = {
        'length': float(pitch_length),
        'width': float(pitch_width),
        'x_offset': float(pitch_length / 2),
        'y_offset': float(pitch_width / 2)
    }

    logger.info("Loaded match metadata from %s (match_id=%s, pitch=%dx%d)",
                json_path, data.get("id"), pitch_length, pitch_width)
    return data


# ─── Function 2 ───────────────────────────────────────────────────────────────
def build_player_lookup(match_data: dict) -> dict:
    """Build a player_id → info dict from match metadata.

    Returns:
        {
            player_id (int): {
                "name": short_name,
                "first_name": first_name,
                "last_name": last_name,
                "team_id": team_id,
                "number": jersey_number,
                "position": role_acronym,
                "position_full": role_name,
                "team": "home" | "away"
            }
        }
    """
    home_team_id: int = match_data["home_team"]["id"]
    lookup: dict = {}

    for player in match_data.get("players", []):
        player_id = int(player["id"])
        team_id = int(player["team_id"])
        role = player.get("player_role") or {}
        lookup[player_id] = {
            "name": player.get("short_name", ""),
            "first_name": player.get("first_name", ""),
            "last_name": player.get("last_name", ""),
            "team_id": team_id,
            "number": player.get("number"),
            "position": role.get("acronym", ""),
            "position_full": role.get("name", ""),
            "team": "home" if team_id == home_team_id else "away",
        }

    logger.info("Built player lookup with %d players", len(lookup))
    return lookup


# ─── Function 3 ───────────────────────────────────────────────────────────────
def resolve_tracking_path(raw_dir: Path, match_id: int) -> Path:
    """Return the tracking JSONL path, trying canonical name then _extrapolated fallback."""
    canonical = raw_dir / f"{match_id}_tracking.jsonl"
    if storage_provider.exists(canonical):
        return canonical
    extrapolated = raw_dir / f"{match_id}_tracking_extrapolated.jsonl"
    if storage_provider.exists(extrapolated):
        logger.info("Using extrapolated tracking file: %s", extrapolated)
        return extrapolated
    # Return canonical path so FileNotFoundError message is clear
    return canonical


def load_tracking_data(
    jsonl_path: Path, processed_dir: Path, match_id: int, match_data: dict = None
) -> pd.DataFrame:
    """Stream tracking JSONL, returning a DataFrame (with parquet caching).

    Parquet cache: processed_dir / f"{match_id}_tracking.parquet"

    Each row represents one player OR the ball at one frame:
        frame, timestamp_str, period, player_id,
        x_raw, y_raw, x_m, y_m, is_detected

    ball rows have player_id == -1.
    Frames before frame 20 and frames with no player_data are skipped.

    Args:
        match_data: Optional match metadata dict containing pitch dimensions
    """
    cache_path = processed_dir / f"{match_id}_tracking.parquet"

    if storage_provider.exists(cache_path):
        logger.info("Loaded tracking data from cache: %s", cache_path)
        # For parquet, we need bytes. storage_provider returns bytes for read_bytes.
        parquet_bytes = storage_provider.read_bytes(cache_path)
        return pd.read_parquet(io.BytesIO(parquet_bytes), engine="pyarrow")

    if not storage_provider.exists(jsonl_path):
        raise FileNotFoundError(
            f"Tracking JSONL not found: {jsonl_path}. "
            "Please upload tracking.jsonl via POST /api/upload/match."
        )

    # Get pitch dimensions from match_data if available
    if match_data and '_pitch_dims' in match_data:
        x_offset = match_data['_pitch_dims']['x_offset']
        y_offset = match_data['_pitch_dims']['y_offset']
    else:
        # Fall back to module-level constants
        x_offset = X_OFFSET
        y_offset = Y_OFFSET

    # Stream from storage_provider (read entire file into memory as we're in serverless context)
    content = storage_provider.read_text(jsonl_path)
    rows = []
    
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue

        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        frame: int = obj.get("frame", 0)
        if frame < 20:
            continue

        player_data = obj.get("player_data")
        if not player_data:
            continue

        timestamp_str: str = obj.get("timestamp", "")
        period = obj.get("period")  # may be None


        # ── Player rows ──────────────────────────────────────────────────
        for pd_entry in player_data:
            rows.append(
                {
                    "frame": frame,
                    "timestamp_str": timestamp_str,
                    "period": period,
                    "player_id": int(pd_entry["player_id"]),
                    "x_raw": float(pd_entry["x"]),
                    "y_raw": float(pd_entry["y"]),
                    "x_m": float(pd_entry["x"]) + x_offset,
                    "y_m": float(pd_entry["y"]) + y_offset,
                    "is_detected": bool(pd_entry.get("is_detected", True)),
                }
            )

        # ── Ball row (player_id = -1) ─────────────────────────────────
        ball = obj.get("ball_data") or {}
        bx = ball.get("x")
        by = ball.get("y")
        if bx is not None and by is not None:
            rows.append(
                {
                    "frame": frame,
                    "timestamp_str": timestamp_str,
                    "period": period,
                    "player_id": -1,
                    "x_raw": float(bx),
                    "y_raw": float(by),
                    "x_m": float(bx) + x_offset,
                    "y_m": float(by) + y_offset,
                    "is_detected": bool(ball.get("is_detected", True)),
                }
            )

    logger.info("Streaming complete — building DataFrame from %d rows", len(rows))

    df = pd.DataFrame(rows)

    if df.empty:
        logger.warning("Tracking DataFrame is empty after parsing!")
        return df

    # ── Apply dtypes ─────────────────────────────────────────────────────────
    df["frame"] = df["frame"].astype("int32")
    df["player_id"] = df["player_id"].astype("int32")
    df["period"] = pd.array(df["period"], dtype="Int8")  # nullable integer
    df["x_raw"] = df["x_raw"].astype("float32")
    df["y_raw"] = df["y_raw"].astype("float32")
    df["x_m"] = df["x_m"].astype("float32")
    df["y_m"] = df["y_m"].astype("float32")
    df["is_detected"] = df["is_detected"].astype(bool)

    # ── Save parquet cache ───────────────────────────────────────────────────
    # LocalStorage handles mkdir. GCSStorage doesn't need it.
    # To save to parquet and then to GCS, we use an in-memory buffer
    buffer = io.BytesIO()
    df.to_parquet(buffer, engine="pyarrow", index=False)
    
    # We need a write_bytes method in storage_provider for this
    if hasattr(storage_provider, 'write_bytes'):
        storage_provider.write_bytes(cache_path, buffer.getvalue())
    else:
        # Fallback if I haven't added write_bytes yet (let's add it to storage.py next)
        with open(cache_path, "wb") as f:
            f.write(buffer.getvalue())
            
    logger.info("Saved parquet cache to %s", cache_path)

    return df


# ─── Function 4 ───────────────────────────────────────────────────────────────
def get_frame_data(tracking_df: pd.DataFrame, frame_number: int) -> dict:
    """Return player and ball data for a single frame.

    Returns:
        {
            "frame": int,
            "players": list[dict],   # rows where player_id != -1
            "ball": {"x_m": float, "y_m": float} | None
        }
    """
    frame_df = tracking_df[tracking_df["frame"] == frame_number]

    players_df = frame_df[frame_df["player_id"] != -1]
    ball_df = frame_df[frame_df["player_id"] == -1]

    ball: dict | None = None
    if not ball_df.empty:
        row = ball_df.iloc[0]
        ball = {"x_m": float(row["x_m"]), "y_m": float(row["y_m"])}

    return {
        "frame": frame_number,
        "players": players_df.to_dict("records"),
        "ball": ball,
    }


# ─── Function 5 ───────────────────────────────────────────────────────────────
def frame_to_time(frame: int, match_periods: list) -> dict:
    """Convert an absolute frame number to period time.

    Returns:
        {
            "period": int,
            "minutes": int,
            "seconds": int,
            "deciseconds": int,
            "timestamp": "MM:SS.d"
        }
    """
    matched_period = None
    for p in match_periods:
        if p["start_frame"] <= frame <= p["end_frame"]:
            matched_period = p
            break

    # If frame outside any period, use the closest period
    if matched_period is None:
        # Pick first or last period based on frame position
        if frame < match_periods[0]["start_frame"]:
            matched_period = match_periods[0]
        else:
            matched_period = match_periods[-1]

    period_start_frame: int = matched_period["start_frame"]
    period_num: int = matched_period["period"]

    frames_into_period = frame - period_start_frame
    total_seconds = frames_into_period / FPS
    minutes = int(total_seconds // 60)
    seconds = int(total_seconds % 60)
    deciseconds = int((total_seconds * 10) % 10)

    return {
        "period": period_num,
        "minutes": minutes,
        "seconds": seconds,
        "deciseconds": deciseconds,
        "timestamp": f"{minutes:02d}:{seconds:02d}.{deciseconds}",
    }


# ─── Function 6 ───────────────────────────────────────────────────────────────
def time_to_frame(
    period: int,
    minutes: int,
    seconds: int,
    deciseconds: int,
    match_periods: list,
) -> int:
    """Convert period + time components to an absolute frame number.

    Clamps result within the period's [start_frame, end_frame].
    """
    matched_period = None
    for p in match_periods:
        if p["period"] == period:
            matched_period = p
            break

    if matched_period is None:
        raise ValueError(f"Period {period} not found in match_periods.")

    period_start_frame: int = matched_period["start_frame"]
    period_end_frame: int = matched_period["end_frame"]

    total_seconds = minutes * 60 + seconds + deciseconds * 0.1
    frame = period_start_frame + int(total_seconds * FPS)

    # Clamp to period bounds
    frame = max(period_start_frame, min(period_end_frame, frame))
    return frame
