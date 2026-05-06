"""
voronoi_engine.py — Voronoi Diagram Computation for Pitch Control

Computes Voronoi regions for players on the pitch, clipped to pitch bounds.
Uses mirror points to bound infinite regions.
"""

import logging

import numpy as np
from scipy.spatial import Voronoi
from shapely.geometry import Polygon, box

logger = logging.getLogger(__name__)

# ─── Pitch bounds ─────────────────────────────────────────────────────────────
PITCH_BOUNDS = box(0, 0, 105, 68)  # Shapely box for clipping


def compute_voronoi(
    players: list[dict],  # {player_id, x_m, y_m, team_id, name}
    home_team_id: int,
    home_color: str = "#0000FF",
    away_color: str = "#FF0000",
) -> dict:
    """Compute Voronoi regions for players, clipped to pitch bounds.

    Args:
        players: List of player dicts with player_id, x_m, y_m, team_id, name
        home_team_id: Home team ID to distinguish teams
        home_color: Color for home team regions
        away_color: Color for away team regions

    Returns:
        {
            "regions": [
                {
                    "player_id": int,
                    "name": str,
                    "team_id": int,
                    "team": "home" or "away",
                    "color": str,
                    "polygon": [[x,y], ...],
                    "area_m2": float
                }
            ],
            "summary": {
                "home_area": float,
                "away_area": float,
                "home_pct": float,
                "away_pct": float
            }
        }
    """
    if not players:
        return {
            "regions": [],
            "summary": {
                "home_area": 0.0,
                "away_area": 0.0,
                "home_pct": 0.0,
                "away_pct": 0.0,
            },
        }

    # ── Step 1: Extract player positions ──────────────────────────────────────
    points = []
    player_info = []

    for p in players:
        # Skip if missing coordinates
        if p.get("x_m") is None or p.get("y_m") is None:
            continue

        points.append([p["x_m"], p["y_m"]])
        player_info.append(
            {
                "player_id": p["player_id"],
                "name": p.get("name", str(p["player_id"])),
                "team_id": p["team_id"],
                "team": "home" if p["team_id"] == home_team_id else "away",
                "color": home_color if p["team_id"] == home_team_id else away_color,
            }
        )

    if len(points) < 3:
        logger.warning("Not enough points for Voronoi diagram (need >= 3)")
        return {
            "regions": [],
            "summary": {
                "home_area": 0.0,
                "away_area": 0.0,
                "home_pct": 0.0,
                "away_pct": 0.0,
            },
        }

    points_array = np.array(points)
    n_real = len(points_array)

    # ── Step 2: Add mirror points far outside pitch to bound diagram ──────────
    # Add 4 corners far outside the pitch to prevent infinite Voronoi regions
    mirror_points = np.array(
        [
            [-200, -200],
            [200, -200],
            [200, 200],
            [-200, 200],
        ]
    )

    all_points = np.vstack([points_array, mirror_points])

    # ── Step 3: Compute Voronoi diagram ───────────────────────────────────────
    try:
        vor = Voronoi(all_points)
    except Exception as exc:
        logger.error("Voronoi computation failed: %s", exc)
        return {
            "regions": [],
            "summary": {
                "home_area": 0.0,
                "away_area": 0.0,
                "home_pct": 0.0,
                "away_pct": 0.0,
            },
        }

    # ── Step 4: Extract and clip regions for real players ─────────────────────
    regions_out = []
    home_total_area = 0.0
    away_total_area = 0.0

    for i in range(n_real):
        region_idx = vor.point_region[i]
        region_vertices = vor.regions[region_idx]

        # Skip empty or infinite regions (containing -1)
        if not region_vertices or -1 in region_vertices:
            continue

        # Get polygon vertices
        polygon_coords = vor.vertices[region_vertices]

        try:
            # Create Shapely polygon
            poly = Polygon(polygon_coords)

            # Clip to pitch bounds
            clipped = poly.intersection(PITCH_BOUNDS)

            # Skip if empty after clipping
            if clipped.is_empty or clipped.area < 0.01:
                continue

            # Convert to coordinate list
            if clipped.geom_type == "Polygon":
                coords = list(clipped.exterior.coords[:-1])  # Remove duplicate last point
            else:
                # Handle MultiPolygon (take largest part)
                polygons = list(clipped.geoms) if hasattr(clipped, "geoms") else [clipped]
                largest = max(polygons, key=lambda p: p.area)
                coords = list(largest.exterior.coords[:-1])

            area = clipped.area

            # Build region dict
            info = player_info[i]
            region = {
                "player_id": info["player_id"],
                "name": info["name"],
                "team_id": info["team_id"],
                "team": info["team"],
                "color": info["color"],
                "polygon": [[float(x), float(y)] for x, y in coords],
                "area_m2": float(area),
            }

            regions_out.append(region)

            # Accumulate team areas
            if info["team"] == "home":
                home_total_area += area
            else:
                away_total_area += area

        except Exception as exc:
            logger.warning("Failed to process region for player %d: %s", player_info[i]["player_id"], exc)
            continue

    # ── Step 5: Compute summary ───────────────────────────────────────────────
    total_area = home_total_area + away_total_area
    home_pct = (home_total_area / total_area * 100) if total_area > 0 else 0.0
    away_pct = (away_total_area / total_area * 100) if total_area > 0 else 0.0

    summary = {
        "home_area": float(home_total_area),
        "away_area": float(away_total_area),
        "home_pct": float(home_pct),
        "away_pct": float(away_pct),
    }

    return {
        "regions": regions_out,
        "summary": summary,
    }
