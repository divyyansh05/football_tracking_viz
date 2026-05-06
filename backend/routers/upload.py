"""
routers/upload.py — File Upload Endpoint

Accepts multipart form with match_data.json + tracking.jsonl.
Saves files to data/raw/, clears any stale cache, and returns match_id.
"""

import json
import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from routers import match as match_router

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["upload"])

RAW_DATA_DIR = Path("data/raw")
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/match")
async def upload_match(
    match_json: UploadFile = File(..., description="match_data.json file"),
    tracking_jsonl: UploadFile = File(..., description="tracking.jsonl file"),
) -> dict:
    """Upload match data and tracking files.

    Saves files to data/raw/{match_id}_match_data.json and
    data/raw/{match_id}_tracking.jsonl.  Clears any cached data for this
    match so the next request triggers fresh parsing.

    Returns:
        {"match_id": int, "status": "uploaded", "message": str}
    """
    # ── Step 0: Validate filenames ────────────────────────────────────────────
    if not match_json.filename or not match_json.filename.endswith(".json"):
        raise HTTPException(
            status_code=400,
            detail="match_json must be a .json file",
        )

    if not tracking_jsonl.filename or not tracking_jsonl.filename.endswith(".jsonl"):
        raise HTTPException(
            status_code=400,
            detail="tracking_jsonl must be a .jsonl file",
        )

    # ── Step 1: Read and parse match JSON ─────────────────────────────────────
    try:
        raw_bytes = await match_json.read()
        match_data = json.loads(raw_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse match_json as JSON: {exc}",
        ) from exc

    match_id = match_data.get("id")
    if match_id is None:
        raise HTTPException(
            status_code=400,
            detail="match_json does not contain a top-level 'id' field.",
        )
    match_id = int(match_id)

    # ── Step 2: Save match JSON ───────────────────────────────────────────────
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    match_json_path = RAW_DATA_DIR / f"{match_id}_match_data.json"
    try:
        match_json_path.write_bytes(raw_bytes)
        logger.info("Saved match metadata to %s", match_json_path)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write match metadata to disk: {exc}",
        ) from exc

    # ── Step 3: Save tracking JSONL ───────────────────────────────────────────
    tracking_path = RAW_DATA_DIR / f"{match_id}_tracking.jsonl"
    try:
        with open(tracking_path, "wb") as out_fh:
            # Stream in 1 MB chunks to avoid loading entire file into memory
            await tracking_jsonl.seek(0)
            while True:
                chunk = await tracking_jsonl.read(1024 * 1024)
                if not chunk:
                    break
                out_fh.write(chunk)
        logger.info("Saved tracking JSONL to %s", tracking_path)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write tracking JSONL to disk: {exc}",
        ) from exc

    # ── Step 4: Invalidate in-process cache for this match ────────────────────
    for cache_dict in (
        match_router._match_data_cache,
        match_router._tracking_df_cache,
        match_router._player_lookup_cache,
    ):
        cache_dict.pop(match_id, None)

    logger.info("Cache cleared for match_id=%d", match_id)

    # ── Step 5: Delete existing parquet cache so it reprocesses ───────────────
    processed_dir = Path("data/processed")
    parquet_cache = processed_dir / f"{match_id}_tracking.parquet"
    if parquet_cache.exists():
        try:
            parquet_cache.unlink()
            logger.info("Deleted stale parquet cache: %s", parquet_cache)
        except OSError as exc:
            logger.warning("Could not delete parquet cache: %s", exc)

    # ── Step 6: Return immediately — parsing triggered on first data request ──
    return {
        "match_id": match_id,
        "status": "uploaded",
        "message": (
            f"Files saved successfully for match {match_id}. "
            "Processing will begin on the first data request "
            "(GET /api/match/{match_id}/metadata)."
        ),
    }
