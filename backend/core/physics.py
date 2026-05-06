"""
physics.py — Player Motion Physics Computation

Computes velocity, acceleration, speed, and heading from raw positional data.
Operates on the full tracking DataFrame (all frames, all players).
Ball rows (player_id == -1) receive zero physics values.
"""

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Physiological / sensor clipping bounds
SPEED_MAX_MS: float = 12.0   # m/s  (~43 km/h — elite sprint cap)
ACCEL_MAX_MS2: float = 20.0  # m/s²
DELTA_T: float = 0.1         # seconds per frame at 10 Hz


def compute_physics(tracking_df: pd.DataFrame) -> pd.DataFrame:
    """Add kinematic columns to tracking_df in-place and return it.

    Added columns:
        vx           — forward velocity in x direction (m/s)
        vy           — forward velocity in y direction (m/s)
        speed        — scalar speed = sqrt(vx²+vy²) (m/s), clipped [0, 12]
        ax           — x acceleration (m/s²)
        ay           — y acceleration (m/s²)
        accel        — scalar acceleration (m/s²), clipped [0, 20]
        direction_deg — heading in degrees (arctan2)

    Ball rows (player_id == -1) receive 0.0 for all physics columns.

    The function does NOT assume the DataFrame is sorted; it sorts per player.
    """
    if tracking_df.empty:
        for col in ("vx", "vy", "speed", "ax", "ay", "accel", "direction_deg"):
            tracking_df[col] = 0.0
        return tracking_df

    logger.info("Computing physics for %d rows...", len(tracking_df))

    # Pre-allocate output arrays aligned with tracking_df index
    idx = tracking_df.index
    vx_out = np.zeros(len(tracking_df), dtype="float32")
    vy_out = np.zeros(len(tracking_df), dtype="float32")
    speed_out = np.zeros(len(tracking_df), dtype="float32")
    ax_out = np.zeros(len(tracking_df), dtype="float32")
    ay_out = np.zeros(len(tracking_df), dtype="float32")
    accel_out = np.zeros(len(tracking_df), dtype="float32")
    dir_out = np.zeros(len(tracking_df), dtype="float32")

    # Build integer position array for fast index mapping
    idx_to_pos = {orig_idx: pos for pos, orig_idx in enumerate(idx)}

    # Process each player (exclude ball)
    player_ids = tracking_df.loc[tracking_df["player_id"] != -1, "player_id"].unique()

    for pid in player_ids:
        mask = (tracking_df["player_id"] == pid)
        player_rows = tracking_df[mask].sort_values("frame")

        positions = [idx_to_pos[i] for i in player_rows.index]

        x = player_rows["x_m"].to_numpy(dtype="float64")
        y = player_rows["y_m"].to_numpy(dtype="float64")

        # Velocity (forward difference; first element = 0)
        vx = np.empty(len(x), dtype="float64")
        vy = np.empty(len(y), dtype="float64")
        vx[0] = 0.0
        vy[0] = 0.0
        vx[1:] = np.diff(x) / DELTA_T
        vy[1:] = np.diff(y) / DELTA_T

        speed = np.sqrt(vx**2 + vy**2)

        # Acceleration (forward difference on velocity; first element = 0)
        ax = np.empty(len(vx), dtype="float64")
        ay = np.empty(len(vy), dtype="float64")
        ax[0] = 0.0
        ay[0] = 0.0
        ax[1:] = np.diff(vx) / DELTA_T
        ay[1:] = np.diff(vy) / DELTA_T

        accel = np.sqrt(ax**2 + ay**2)
        direction_deg = np.degrees(np.arctan2(vy, vx))

        # Clip to physiological bounds
        speed = np.clip(speed, 0.0, SPEED_MAX_MS)
        accel = np.clip(accel, 0.0, ACCEL_MAX_MS2)

        # Replace NaN with 0
        vx = np.nan_to_num(vx, nan=0.0)
        vy = np.nan_to_num(vy, nan=0.0)
        speed = np.nan_to_num(speed, nan=0.0)
        ax = np.nan_to_num(ax, nan=0.0)
        ay = np.nan_to_num(ay, nan=0.0)
        accel = np.nan_to_num(accel, nan=0.0)
        direction_deg = np.nan_to_num(direction_deg, nan=0.0)

        # Write back to output arrays
        for local_i, pos in enumerate(positions):
            vx_out[pos] = vx[local_i]
            vy_out[pos] = vy[local_i]
            speed_out[pos] = speed[local_i]
            ax_out[pos] = ax[local_i]
            ay_out[pos] = ay[local_i]
            accel_out[pos] = accel[local_i]
            dir_out[pos] = direction_deg[local_i]

    # Assign all columns at once (avoids repeated DataFrame fragmentation)
    tracking_df = tracking_df.copy()
    tracking_df["vx"] = vx_out
    tracking_df["vy"] = vy_out
    tracking_df["speed"] = speed_out
    tracking_df["ax"] = ax_out
    tracking_df["ay"] = ay_out
    tracking_df["accel"] = accel_out
    tracking_df["direction_deg"] = dir_out

    logger.info("Physics computation complete.")
    return tracking_df
