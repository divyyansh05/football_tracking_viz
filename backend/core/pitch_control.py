"""
pitch_control.py — Pitch Control Model (Spearman 2017)

Computes territorial control per grid cell for home vs away teams.
Uses fully vectorised NumPy operations — no Python loops over grid cells.

Reference:
  Spearman, W. (2017). "Physics-Based Modeling of Pass Probabilities in Soccer"
  MIT Sloan Sports Analytics Conference.
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)

# ─── Model constants ──────────────────────────────────────────────────────────
PITCH_WIDTH: float = 105.0
PITCH_HEIGHT: float = 68.0
MAX_PLAYER_SPEED: float = 7.0    # m/s — assumed max reach speed
REACTION_TIME: float = 0.3       # seconds — decision latency
SIGMOID_K: float = 3.0           # sigmoid steepness parameter
GRID_RES: float = 1.0            # metres per grid cell


def compute_pitch_control(
    frame_players: list[dict],
    home_team_id: int,
    grid_res: float = GRID_RES,
) -> dict:
    """Compute pitch control for one frame using the Spearman 2017 model.

    Args:
        frame_players: list of dicts with keys {player_id, x_m, y_m, team_id}.
                       Ball (player_id == -1) is automatically excluded.
        home_team_id:  team_id value identifying the home team.
        grid_res:      grid resolution in metres (default 1.0 m).

    Returns:
        {
            "home_pct":  2-D list [n_y][n_x], values in [0.0, 1.0],
            "x_coords":  list[float] — x axis grid values (len n_x),
            "y_coords":  list[float] — y axis grid values (len n_y),
            "summary": {
                "home_control_pct": float (0-100),
                "away_control_pct": float (0-100)
            }
        }
    """
    # ── Step 1: Build grid ────────────────────────────────────────────────────
    x_coords = np.arange(0, PITCH_WIDTH + grid_res, grid_res)   # shape (n_x,)
    y_coords = np.arange(0, PITCH_HEIGHT + grid_res, grid_res)  # shape (n_y,)
    grid_x, grid_y = np.meshgrid(x_coords, y_coords)            # (n_y, n_x)

    # ── Step 2: Filter to outfield players only ───────────────────────────────
    players = [p for p in frame_players if p.get("player_id", -1) != -1]

    if not players:
        logger.warning("No players in frame — returning uniform 0.5 control.")
        uniform = np.full_like(grid_x, 0.5, dtype="float32")
        return {
            "home_pct": uniform.tolist(),
            "x_coords": x_coords.tolist(),
            "y_coords": y_coords.tolist(),
            "summary": {"home_control_pct": 50.0, "away_control_pct": 50.0},
        }

    n_players = len(players)

    # ── Step 3: Compute time for each player to reach every grid cell ─────────
    # player_x/y: shape (n_players, 1, 1) — broadcasts over grid
    player_x = np.array([p["x_m"] for p in players], dtype="float64").reshape(n_players, 1, 1)
    player_y = np.array([p["y_m"] for p in players], dtype="float64").reshape(n_players, 1, 1)

    # grid_x / grid_y: (1, n_y, n_x) for broadcasting
    gx = grid_x[np.newaxis, :, :]  # (1, n_y, n_x)
    gy = grid_y[np.newaxis, :, :]

    # Euclidean distance: (n_players, n_y, n_x)
    distances = np.sqrt((gx - player_x) ** 2 + (gy - player_y) ** 2)

    # Time to reach cell: distance / speed + reaction time
    times = distances / MAX_PLAYER_SPEED + REACTION_TIME  # (n_players, n_y, n_x)

    # ── Step 4: Minimum time across all players ───────────────────────────────
    t_min = np.min(times, axis=0)  # (n_y, n_x)

    # ── Step 5: Sigmoid influence per player ─────────────────────────────────
    # influence[i] = sigmoid(-(t_min - times[i]) * k)
    # = 1 / (1 + exp(-(t_min - times[i]) * k))
    # High influence when player i arrives close to the global minimum time.
    delta = t_min[np.newaxis, :, :] - times  # (n_players, n_y, n_x), ≤ 0
    influence = 1.0 / (1.0 + np.exp(-delta * SIGMOID_K))  # (n_players, n_y, n_x)

    # ── Step 6: Aggregate per team ────────────────────────────────────────────
    home_mask = np.array(
        [1.0 if p["team_id"] == home_team_id else 0.0 for p in players],
        dtype="float64",
    ).reshape(n_players, 1, 1)
    away_mask = 1.0 - home_mask

    home_control = np.sum(influence * home_mask, axis=0)  # (n_y, n_x)
    away_control = np.sum(influence * away_mask, axis=0)

    total = home_control + away_control
    home_pct = home_control / (total + 1e-8)  # avoid div-by-zero

    # ── Step 7: Summary stats ─────────────────────────────────────────────────
    mean_home = float(np.mean(home_pct))
    mean_away = 1.0 - mean_home

    logger.debug(
        "Pitch control: home=%.1f%% away=%.1f%%",
        mean_home * 100,
        mean_away * 100,
    )

    return {
        "home_pct": home_pct.astype("float32").tolist(),
        "x_coords": x_coords.tolist(),
        "y_coords": y_coords.tolist(),
        "summary": {
            "home_control_pct": round(mean_home * 100, 1),
            "away_control_pct": round(mean_away * 100, 1),
        },
    }
