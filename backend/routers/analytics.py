from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import pandas as pd
import numpy as np
from scipy.stats import gaussian_kde
from routers.match import get_match_resources

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/{match_id}/heatmap/{player_id}")
def get_player_heatmap(match_id: int, player_id: int, period: int = Query(0, description="0=full, 1=P1, 2=P2")):
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        
        # Filter by player
        df = tracking_df[tracking_df["player_id"] == player_id]
        if df.empty:
            raise HTTPException(status_code=404, detail="Player not found in tracking data")
            
        # Filter by period if needed
        if period != 0:
            df = df[df["period"] == period]
            if df.empty:
                raise HTTPException(status_code=404, detail=f"No data for player in period {period}")
                
        df = df.dropna(subset=["x_m", "y_m"])
        df = df[(df["x_m"] != 0) | (df["y_m"] != 0)]
        
        if len(df) < 10:
            raise HTTPException(status_code=400, detail="Not enough data points to compute heatmap")
            
        x_m_array = df["x_m"].values
        y_m_array = df["y_m"].values
        
        # KDE
        positions = np.vstack([x_m_array, y_m_array])
        kde = gaussian_kde(positions, bw_method=0.15)
        
        x_grid = np.linspace(0, 105, 105)
        y_grid = np.linspace(0, 68, 68)
        xx, yy = np.meshgrid(x_grid, y_grid)
        grid_points = np.vstack([xx.ravel(), yy.ravel()])
        
        z = kde(grid_points).reshape(68, 105)
        # Normalize to 0-1
        z = (z - z.min()) / (z.max() - z.min() + 1e-8)
        
        # Stats
        total_frames = len(df)
        minutes_tracked = total_frames / (10 * 60)
        avg_x = float(np.mean(x_m_array))
        avg_y = float(np.mean(y_m_array))
        
        # Zone computation
        y_zones = np.where(y_m_array < 22.6, "Left", np.where(y_m_array < 45.3, "Center", "Right"))
        x_zones = np.where(x_m_array < 52.5, "Defensive Half", "Attacking Half")
        zones = np.char.add(np.char.add(y_zones, " "), x_zones)
        
        unique, counts = np.unique(zones, return_counts=True)
        most_common_zone = unique[np.argmax(counts)]
        
        info = player_lookup.get(player_id, {})
        
        return {
            "player_id": player_id,
            "player_name": f"{info.get('name', '')} {info.get('last_name', '')}".strip(),
            "team": info.get("team", "unknown"),
            "period": period,
            "heatmap": z.tolist(),
            "x_grid": x_grid.tolist(),
            "y_grid": y_grid.tolist(),
            "stats": {
                "frames_tracked": total_frames,
                "minutes_tracked": float(round(minutes_tracked, 1)),
                "most_common_zone": str(most_common_zone),
                "avg_x": float(round(avg_x, 2)),
                "avg_y": float(round(avg_y, 2))
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{match_id}/distance")
def get_distance_covered(match_id: int):
    """Compute and return cumulative distance covered per player."""
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        
        # Filter out the ball
        df = tracking_df[tracking_df["player_id"] != -1].copy()
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No player tracking data found")
            
        periods = match_data.get("match_periods", [])
        
        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 2)
            if periods and frame_num > periods[-1]["end_frame"]:
                p = periods[-1]
                frames_into = frame_num - p["start_frame"]
                mins = frames_into / (10 * 60)
                if p["period"] == 2:
                    mins += 45
                return round(mins, 2)
            return 0.0

        players_out = []
        home_total_km = 0.0
        away_total_km = 0.0
        
        # Group by player
        for pid, group in df.groupby("player_id"):
            group = group.sort_values("frame")
            speed = group["speed"].fillna(0).values
            dist_m = speed * 0.1
            cum_dist_km = np.cumsum(dist_m) / 1000.0
            
            group["cum_dist_km"] = cum_dist_km
            
            p1_end = periods[0]["end_frame"] if len(periods) > 0 else 0
            
            p1_mask = group["frame"] <= p1_end
            p2_mask = group["frame"] > p1_end
            
            p1_dist = np.sum(dist_m[p1_mask]) / 1000.0
            p2_dist = np.sum(dist_m[p2_mask]) / 1000.0
            total_dist = cum_dist_km[-1] if len(cum_dist_km) > 0 else 0.0
            
            # Resample every 10th row for timeline payload size
            resampled = group.iloc[::10]
            
            timeline = []
            for _, row in resampled.iterrows():
                f = row["frame"]
                mins = get_match_minute(f)
                timeline.append({
                    "minute": float(mins),
                    "cumulative_km": float(round(row["cum_dist_km"], 3))
                })
                
            info = player_lookup.get(pid, {})
            team_side = info.get("team", "unknown")
            
            if team_side == "home":
                home_total_km += total_dist
            elif team_side == "away":
                away_total_km += total_dist
                
            players_out.append({
                "player_id": int(pid),
                "name": info.get("name", ""),
                "last_name": info.get("last_name", ""),
                "position": info.get("position", ""),
                "team": team_side,
                "team_id": info.get("team_id", -1),
                "timeline": timeline,
                "total_distance_km": float(round(total_dist, 2)),
                "period_1_km": float(round(p1_dist, 2)),
                "period_2_km": float(round(p2_dist, 2))
            })
            
        home_players = [p for p in players_out if p["team"] == "home"]
        away_players = [p for p in players_out if p["team"] == "away"]
        
        home_players.sort(key=lambda x: x["total_distance_km"], reverse=True)
        away_players.sort(key=lambda x: x["total_distance_km"], reverse=True)
        
        return {
            "players": home_players + away_players,
            "team_summary": {
                "home": {
                    "name": match_data["home_team"]["name"],
                    "total_km": float(round(home_total_km, 1)),
                    "avg_km_per_player": float(round(home_total_km / len(home_players) if home_players else 0, 2))
                },
                "away": {
                    "name": match_data["away_team"]["name"],
                    "total_km": float(round(away_total_km, 1)),
                    "avg_km_per_player": float(round(away_total_km / len(away_players) if away_players else 0, 2))
                }
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{match_id}/speed/{player_id}")
def get_player_speed_profile(match_id: int, player_id: int):
    """Compute and return speed profile, zones, and sprints for a player."""
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        
        df = tracking_df[tracking_df["player_id"] == player_id].copy()
        if df.empty:
            raise HTTPException(status_code=404, detail="Player not found in tracking data")
            
        periods = match_data.get("match_periods", [])
        
        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 2)
            if periods and frame_num > periods[-1]["end_frame"]:
                p = periods[-1]
                frames_into = frame_num - p["start_frame"]
                mins = frames_into / (10 * 60)
                if p["period"] == 2:
                    mins += 45
                return round(mins, 2)
            return 0.0

        df = df.sort_values("frame")
        df["speed_kmh"] = df["speed"] * 3.6
        
        def get_zone(speed_ms):
            if speed_ms < 2.0: return "Walking"
            elif speed_ms < 4.0: return "Jogging"
            elif speed_ms < 5.5: return "Running"
            elif speed_ms < 7.0: return "High Speed"
            else: return "Sprint"

        df["zone"] = df["speed"].apply(get_zone)
        
        sampled = df.iloc[::5]
        timeline = []
        for _, row in sampled.iterrows():
            timeline.append({
                "minute": get_match_minute(row["frame"]),
                "speed_ms": float(round(row["speed"], 2)),
                "speed_kmh": float(round(row["speed_kmh"], 2)),
                "zone": row["zone"]
            })
            
        total_frames = len(df)
        zone_counts = df["zone"].value_counts()
        zones_data = {}
        for z_name, z_key in [("Walking", "walking"), ("Jogging", "jogging"), 
                              ("Running", "running"), ("High Speed", "high_speed"), 
                              ("Sprint", "sprint")]:
            frames_in_zone = zone_counts.get(z_name, 0)
            secs = frames_in_zone * 0.1
            pct = (frames_in_zone / total_frames) * 100 if total_frames > 0 else 0
            zones_data[z_key] = {
                "seconds": float(round(secs, 1)),
                "pct": float(round(pct, 1))
            }
            
        sprints = []
        current_sprint = None
        sprint_count = 0
        total_sprint_distance = 0.0
        
        for _, row in df.iterrows():
            if row["speed"] > 7.0:
                if current_sprint is None:
                    current_sprint = {
                        "start_frame": row["frame"],
                        "start_minute": get_match_minute(row["frame"]),
                        "start_x": row["x_m"],
                        "start_y": row["y_m"],
                        "max_speed_kmh": row["speed_kmh"],
                        "frames": 1,
                        "distance_m": row["speed"] * 0.1
                    }
                else:
                    current_sprint["frames"] += 1
                    current_sprint["distance_m"] += row["speed"] * 0.1
                    if row["speed_kmh"] > current_sprint["max_speed_kmh"]:
                        current_sprint["max_speed_kmh"] = row["speed_kmh"]
                    current_sprint["end_x"] = row["x_m"]
                    current_sprint["end_y"] = row["y_m"]
            else:
                if current_sprint is not None:
                    if current_sprint["frames"] >= 5:
                        sprints.append({
                            "start_minute": float(round(current_sprint["start_minute"], 2)),
                            "duration_seconds": float(round(current_sprint["frames"] * 0.1, 1)),
                            "max_speed_kmh": float(round(current_sprint["max_speed_kmh"], 2)),
                            "start_x": float(round(current_sprint["start_x"], 2)),
                            "start_y": float(round(current_sprint["start_y"], 2)),
                            "end_x": float(round(current_sprint.get("end_x", current_sprint["start_x"]), 2)),
                            "end_y": float(round(current_sprint.get("end_y", current_sprint["start_y"]), 2))
                        })
                        sprint_count += 1
                        total_sprint_distance += current_sprint["distance_m"]
                    current_sprint = None
                    
        max_speed_row = df.loc[df["speed_kmh"].idxmax()] if not df.empty else None
        max_speed_kmh = float(round(max_speed_row["speed_kmh"], 2)) if max_speed_row is not None else 0.0
        max_speed_minute = float(round(get_match_minute(max_speed_row["frame"]), 2)) if max_speed_row is not None else 0.0
        
        high_intensity_df = df[df["speed"] > 5.5]
        high_intensity_distance_m = float(round((high_intensity_df["speed"] * 0.1).sum(), 1))
        
        info = player_lookup.get(player_id, {})
        
        return {
            "player_id": player_id,
            "player_name": f"{info.get('name', '')} {info.get('last_name', '')}".strip(),
            "team": info.get("team", "unknown"),
            "timeline": timeline,
            "zones": zones_data,
            "sprints": sprints,
            "peak": {
                "max_speed_kmh": max_speed_kmh,
                "max_speed_minute": max_speed_minute,
                "sprint_count": sprint_count,
                "total_sprint_distance_m": float(round(total_sprint_distance, 1)),
                "high_intensity_distance_m": high_intensity_distance_m
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

import scipy.spatial

@router.get("/{match_id}/convex-hull/{frame_number}")
def get_convex_hull(match_id: int, frame_number: int):
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        
        df = tracking_df[tracking_df["frame"] == frame_number].copy()
        if df.empty:
            raise HTTPException(status_code=404, detail="Frame not found")
            
        home_players = []
        away_players = []
        
        for _, row in df.iterrows():
            pid = row["player_id"]
            if pid == -1:
                continue
            info = player_lookup.get(pid, {})
            pos = info.get("position", "")
            
            if "GK" in str(pos).upper():
                continue
                
            team = info.get("team", "unknown")
            if team == "home":
                home_players.append((row["x_m"], row["y_m"]))
            elif team == "away":
                away_players.append((row["x_m"], row["y_m"]))
                
        def compute_hull(positions):
            if len(positions) < 3:
                return {
                    "hull_polygon": [],
                    "area_m2": 0.0,
                    "centroid": {"x": 0.0, "y": 0.0},
                    "team_length": 0.0,
                    "team_width": 0.0,
                    "player_count": len(positions),
                    "error": f"Insufficient players ({len(positions)}) for hull"
                }

            pos_arr = np.array(positions)

            try:
                hull = scipy.spatial.ConvexHull(pos_arr)
                hull_vertices = [positions[i] for i in hull.vertices]
                hull_vertices.append(hull_vertices[0])
                area = float(hull.volume)
                error = None
            except Exception as e:
                hull_vertices = []
                area = 0.0
                error = f"Hull computation failed: {str(e)}"

            centroid_x = float(np.mean(pos_arr[:, 0]))
            centroid_y = float(np.mean(pos_arr[:, 1]))

            t_length = float(np.max(pos_arr[:, 0]) - np.min(pos_arr[:, 0]))
            t_width = float(np.max(pos_arr[:, 1]) - np.min(pos_arr[:, 1]))

            result = {
                "hull_polygon": [[float(x), float(y)] for x, y in hull_vertices],
                "area_m2": round(area, 1),
                "centroid": {"x": round(centroid_x, 2), "y": round(centroid_y, 2)},
                "team_length": round(t_length, 1),
                "team_width": round(t_width, 1),
                "player_count": len(positions)
            }

            if error:
                result["error"] = error

            return result
            
        home_data = compute_hull(home_players)
        away_data = compute_hull(away_players)
        
        c_dist = 0.0
        if home_data["player_count"] > 0 and away_data["player_count"] > 0:
            c_dist = np.sqrt((home_data["centroid"]["x"] - away_data["centroid"]["x"])**2 + 
                             (home_data["centroid"]["y"] - away_data["centroid"]["y"])**2)
                             
        return {
            "frame": frame_number,
            "home": home_data,
            "away": away_data,
            "centroid_distance": round(c_dist, 2)
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{match_id}/convex-hull-timeline")
def get_convex_hull_timeline(match_id: int, sample_every: int = Query(50)):
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        
        df = tracking_df[tracking_df["player_id"] != -1].copy()
        
        def get_team(pid):
            return player_lookup.get(pid, {}).get("team", "unknown")
            
        def is_gk(pid):
            return "GK" in str(player_lookup.get(pid, {}).get("position", "")).upper()
            
        df["team"] = df["player_id"].apply(get_team)
        df["is_gk"] = df["player_id"].apply(is_gk)
        
        df = df[~df["is_gk"]]
        
        all_frames = np.sort(df["frame"].unique())
        sampled_frames = all_frames[::sample_every]
        
        df_sampled = df[df["frame"].isin(sampled_frames)]
        
        periods = match_data.get("match_periods", [])
        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 2)
            if periods and frame_num > periods[-1]["end_frame"]:
                p = periods[-1]
                frames_into = frame_num - p["start_frame"]
                mins = frames_into / (10 * 60)
                if p["period"] == 2:
                    mins += 45
                return round(mins, 2)
            return 0.0
            
        timeline = []
        for frame, group in df_sampled.groupby("frame"):
            home_pts = group[group["team"] == "home"][["x_m", "y_m"]].values
            away_pts = group[group["team"] == "away"][["x_m", "y_m"]].values
            
            home_area = 0.0
            away_area = 0.0
            c_dist = 0.0
            
            if len(home_pts) >= 3:
                try:
                    home_area = scipy.spatial.ConvexHull(home_pts).volume
                except Exception:
                    pass
                    
            if len(away_pts) >= 3:
                try:
                    away_area = scipy.spatial.ConvexHull(away_pts).volume
                except Exception:
                    pass
                    
            if len(home_pts) > 0 and len(away_pts) > 0:
                h_c = np.mean(home_pts, axis=0)
                a_c = np.mean(away_pts, axis=0)
                c_dist = np.sqrt(np.sum((h_c - a_c)**2))
                
            timeline.append({
                "minute": get_match_minute(frame),
                "home_area_m2": float(round(home_area, 1)),
                "away_area_m2": float(round(away_area, 1)),
                "centroid_distance": float(round(c_dist, 2))
            })
            
        return {"timeline": timeline}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{match_id}/formation")
def get_formation(match_id: int, window_minutes: int = Query(5), period: int = Query(0)):
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)
        
        df = tracking_df[tracking_df["player_id"] != -1].copy()
        
        if period != 0:
            df = df[df["period"] == period]
            if df.empty:
                return {"windows": [], "total_windows": 0}
                
        periods_meta = match_data.get("match_periods", [])
        
        def get_match_minute(frame_num):
            for p in periods_meta:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return mins
            if periods_meta and frame_num > periods_meta[-1]["end_frame"]:
                p = periods_meta[-1]
                frames_into = frame_num - p["start_frame"]
                mins = frames_into / (10 * 60)
                if p["period"] == 2:
                    mins += 45
                return mins
            return 0.0

        df["minute"] = df["frame"].apply(get_match_minute)
        
        windows = []
        max_min = df["minute"].max()
        if pd.isna(max_min): max_min = 90.0
        
        num_windows = int(np.ceil(max_min / window_minutes))
        
        window_id = 0
        
        for w in range(num_windows):
            start_m = w * window_minutes
            end_m = (w + 1) * window_minutes
            
            mask = (df["minute"] >= start_m) & (df["minute"] < end_m)
            w_df = df[mask]
            
            if w_df.empty:
                continue
                
            total_frames_in_window = w_df["frame"].nunique()
            if total_frames_in_window == 0:
                continue
                
            home_players = []
            away_players = []
            
            for pid, group in w_df.groupby("player_id"):
                frames_present = group["frame"].nunique()
                
                if frames_present < (total_frames_in_window * 0.5):
                    continue
                    
                info = player_lookup.get(pid, {})
                avg_x = float(group["x_m"].mean())
                avg_y = float(group["y_m"].mean())
                
                p_data = {
                    "player_id": int(pid),
                    "name": info.get("name", ""),
                    "last_name": info.get("last_name", ""),
                    "position": info.get("position", ""),
                    "number": info.get("number", 0),
                    "avg_x": round(avg_x, 2),
                    "avg_y": round(avg_y, 2),
                    "frames_present": int(frames_present)
                }
                
                team = info.get("team", "unknown")
                if team == "home":
                    home_players.append(p_data)
                elif team == "away":
                    away_players.append(p_data)
                    
            if home_players or away_players:
                # --- Formation detection ---
                def detect_formation_from_players(outfield_list, is_home):
                    if len(outfield_list) < 6:
                        return "N/A"
                    # Sort by avg_x; remove likely GK
                    sorted_p = sorted(outfield_list, key=lambda p: p["avg_x"])
                    if is_home:
                        sorted_p = sorted_p[1:]  # remove leftmost (GK)
                    else:
                        sorted_p = sorted_p[:-1]  # remove rightmost (GK)
                    if len(sorted_p) < 5:
                        return "N/A"
                    min_x = sorted_p[0]["avg_x"]
                    max_x = sorted_p[-1]["avg_x"]
                    rx = max_x - min_x
                    if rx < 1:
                        return "N/A"
                    def_thresh = min_x + rx * 0.35
                    mid_thresh = min_x + rx * 0.70
                    defenders = [p for p in sorted_p if p["avg_x"] <= def_thresh]
                    midfielders = [p for p in sorted_p if def_thresh < p["avg_x"] <= mid_thresh]
                    forwards = [p for p in sorted_p if p["avg_x"] > mid_thresh]
                    return f"{len(defenders)}-{len(midfielders)}-{len(forwards)}"

                home_formation = detect_formation_from_players(home_players, is_home=True)
                away_formation = detect_formation_from_players(away_players, is_home=False)

                windows.append({
                    "window_id": window_id,
                    "label": f"{start_m}-{end_m} min",
                    "start_minute": float(start_m),
                    "end_minute": float(end_m),
                    "home_players": home_players,
                    "away_players": away_players,
                    "home_formation": home_formation,
                    "away_formation": away_formation,
                })
                window_id += 1
                
        return {
            "windows": windows,
            "total_windows": len(windows)
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/{match_id}/pressing")
def get_pressing(
    match_id: int,
    team: str = Query("home"),
    period: int = Query(0),
    distance_threshold: float = Query(5.0),
    start_minute: Optional[int] = Query(None),
    end_minute: Optional[int] = Query(None)
):
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)

        df = tracking_df.copy()
        if period != 0:
            df = df[df["period"] == period]

        # Filter by minute window if specified
        if start_minute is not None and end_minute is not None:
            periods = match_data.get("match_periods", [])

            def get_minute(frame):
                for p in periods:
                    if p["start_frame"] <= frame <= p["end_frame"]:
                        frames_into = frame - p["start_frame"]
                        mins = frames_into / (10 * 60)
                        if p["period"] == 2:
                            mins += 45
                        return mins
                return 0

            df["minute"] = df["frame"].apply(get_minute)
            df = df[(df["minute"] >= start_minute) & (df["minute"] <= end_minute)]

        if df.empty:
            raise HTTPException(status_code=404, detail="No data for this period")
            
        ball_df = df[df["player_id"] == -1].copy()
        
        team_players = set()
        for pid, info in player_lookup.items():
            if info.get("team") == team:
                team_players.add(pid)
                
        if not team_players:
            raise HTTPException(status_code=404, detail=f"No players found for team {team}")
            
        team_df = df[df["player_id"].isin(team_players)].copy()
        
        ball_df = ball_df.dropna(subset=["x_m", "y_m"])
        if team == "home":
            ball_df = ball_df[ball_df["x_m"] > 52.5]
        else:
            ball_df = ball_df[ball_df["x_m"] < 52.5]
            
        ball_df = ball_df.set_index("frame")
        
        total_frames = df["frame"].nunique()
        
        team_df = team_df.join(ball_df[["x_m", "y_m"]].rename(columns={"x_m": "bx", "y_m": "by"}), on="frame", how="inner")
        
        team_df["dist_to_ball"] = np.sqrt((team_df["x_m"] - team_df["bx"])**2 + (team_df["y_m"] - team_df["by"])**2)
        
        pressing_events = team_df[team_df["dist_to_ball"] < distance_threshold]
        
        pressing_frames = set(pressing_events["frame"].unique())
        pressing_locations = list(zip(pressing_events["bx"].values, pressing_events["by"].values))
        pressing_distances = pressing_events["dist_to_ball"].values.tolist()
        
        if not pressing_locations:
            z = np.zeros((68, 105))
            x_grid = np.linspace(0, 105, 105)
            y_grid = np.linspace(0, 68, 68)
            most_pressed_zone = "None"
            avg_pressing_distance_m = 0.0
        else:
            locs = np.array(pressing_locations)
            locs += np.random.normal(0, 0.1, locs.shape)
            positions = locs.T
            
            try:
                kde = gaussian_kde(positions, bw_method=0.15)
                x_grid = np.linspace(0, 105, 105)
                y_grid = np.linspace(0, 68, 68)
                xx, yy = np.meshgrid(x_grid, y_grid)
                grid_points = np.vstack([xx.ravel(), yy.ravel()])
                
                z = kde(grid_points).reshape(68, 105)
                z = (z - z.min()) / (z.max() - z.min() + 1e-8)
            except Exception:
                z = np.zeros((68, 105))
                x_grid = np.linspace(0, 105, 105)
                y_grid = np.linspace(0, 68, 68)
                
            avg_pressing_distance_m = float(np.mean(pressing_distances))
            
            y_zones = np.where(locs[:, 1] < 22.6, "Left", np.where(locs[:, 1] < 45.3, "Center", "Right"))
            x_zones = np.where(locs[:, 0] < 52.5, "Defensive Half", "Attacking Half")
            zones = np.char.add(np.char.add(y_zones, " "), x_zones)
            unique, counts = np.unique(zones, return_counts=True)
            most_pressed_zone = unique[np.argmax(counts)]
            
        pressing_intensity_pct = (len(pressing_frames) / total_frames) * 100 if total_frames > 0 else 0

        # Zone breakdown (6 zones: 3x2 grid)
        pitch_length = match_data.get("_pitch_dims", {}).get("length", 105.0)
        pitch_width = match_data.get("_pitch_dims", {}).get("width", 68.0)

        zones = {
            "left_def": {"x": (0, pitch_length/3), "y": (0, pitch_width/2), "count": 0},
            "center_def": {"x": (pitch_length/3, 2*pitch_length/3), "y": (0, pitch_width/2), "count": 0},
            "right_def": {"x": (2*pitch_length/3, pitch_length), "y": (0, pitch_width/2), "count": 0},
            "left_att": {"x": (0, pitch_length/3), "y": (pitch_width/2, pitch_width), "count": 0},
            "center_att": {"x": (pitch_length/3, 2*pitch_length/3), "y": (pitch_width/2, pitch_width), "count": 0},
            "right_att": {"x": (2*pitch_length/3, pitch_length), "y": (pitch_width/2, pitch_width), "count": 0},
        }

        for bx, by in pressing_locations:
            for zone_name, zone in zones.items():
                if (zone["x"][0] <= bx < zone["x"][1] and zone["y"][0] <= by < zone["y"][1]):
                    zone["count"] += 1
                    break

        zone_breakdown = {zone_name: zone_data["count"] for zone_name, zone_data in zones.items()}

        # Top pressers: per player, count frames they were near ball
        player_pressing_counts = {}
        for _, row in pressing_events.iterrows():
            pid = row["player_id"]
            if pid not in player_pressing_counts:
                player_pressing_counts[pid] = 0
            player_pressing_counts[pid] += 1

        top_pressers = []
        for pid, count in sorted(player_pressing_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            pinfo = player_lookup.get(pid, {})
            top_pressers.append({
                "player_id": int(pid),
                "name": pinfo.get("name", "Unknown"),
                "team": pinfo.get("team", team),
                "pressing_frames": int(count),
                "pressing_pct": float(round((count / total_frames) * 100, 1)) if total_frames > 0 else 0.0
            })

        # Period breakdown (P1 vs P2 intensity)
        period_breakdown = {}
        if period == 0:  # Only compute if viewing full match
            p1_df = df[df["period"] == 1]
            p2_df = df[df["period"] == 2]

            p1_total = p1_df["frame"].nunique()
            p2_total = p2_df["frame"].nunique()

            p1_pressing_frames = set(pressing_events[pressing_events["frame"].isin(p1_df["frame"])]["frame"])
            p2_pressing_frames = set(pressing_events[pressing_events["frame"].isin(p2_df["frame"])]["frame"])

            p1_intensity = (len(p1_pressing_frames) / p1_total * 100) if p1_total > 0 else 0
            p2_intensity = (len(p2_pressing_frames) / p2_total * 100) if p2_total > 0 else 0

            period_breakdown = {
                "p1_intensity_pct": float(round(p1_intensity, 1)),
                "p2_intensity_pct": float(round(p2_intensity, 1))
            }

        return {
            "team": team,
            "period": period,
            "heatmap": z.tolist(),
            "x_grid": x_grid.tolist(),
            "y_grid": y_grid.tolist(),
            "stats": {
                "pressing_intensity_pct": float(round(pressing_intensity_pct, 1)),
                "total_pressing_events": len(pressing_locations),
                "most_pressed_zone": str(most_pressed_zone),
                "avg_pressing_distance_m": float(round(avg_pressing_distance_m, 2))
            },
            "zone_breakdown": zone_breakdown,
            "top_pressers": top_pressers,
            "period_breakdown": period_breakdown if period_breakdown else None
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{match_id}/centroid")
def get_centroid(match_id: int, sample_every: int = Query(10), smooth_window: int = Query(50)):
    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)

        def is_gk(pid):
            return "GK" in str(player_lookup.get(pid, {}).get("position", "")).upper()

        def get_team(pid):
            return player_lookup.get(pid, {}).get("team", "unknown")

        players_df = tracking_df[tracking_df["player_id"] != -1].copy()
        players_df["team"] = players_df["player_id"].apply(get_team)
        players_df["is_gk"] = players_df["player_id"].apply(is_gk)
        players_df = players_df[~players_df["is_gk"]]

        periods = match_data.get("match_periods", [])

        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 2)
            if periods and frame_num > periods[-1]["end_frame"]:
                p = periods[-1]
                frames_into = frame_num - p["start_frame"]
                mins = frames_into / (10 * 60)
                if p["period"] == 2:
                    mins += 45
                return round(mins, 2)
            return 0.0

        all_frames = np.sort(players_df["frame"].unique())
        sampled_frames = all_frames[::sample_every]

        records = []
        for frame in sampled_frames:
            group = players_df[players_df["frame"] == frame]
            home = group[group["team"] == "home"][["x_m", "y_m"]].dropna()
            away = group[group["team"] == "away"][["x_m", "y_m"]].dropna()
            if home.empty or away.empty:
                continue
            hx, hy = float(home["x_m"].mean()), float(home["y_m"].mean())
            ax, ay = float(away["x_m"].mean()), float(away["y_m"].mean())
            dist = float(np.sqrt((hx - ax) ** 2 + (hy - ay) ** 2))
            records.append({
                "frame": int(frame),
                "minute": get_match_minute(frame),
                "home_x": hx, "home_y": hy,
                "away_x": ax, "away_y": ay,
                "centroid_distance": dist
            })

        if not records:
            raise HTTPException(status_code=404, detail="Not enough tracking data")

        rec_df = pd.DataFrame(records)

        w = min(smooth_window, len(rec_df))
        for col in ["home_x", "home_y", "away_x", "away_y", "centroid_distance"]:
            rec_df[col] = rec_df[col].rolling(w, min_periods=1, center=True).mean()

        rec_df = rec_df.round(2)
        timeline = rec_df.to_dict("records")

        dist_series = rec_df["centroid_distance"]
        min_idx = dist_series.idxmin()
        max_idx = dist_series.idxmax()

        summary = {
            "home_avg_x": float(round(rec_df["home_x"].mean(), 2)),
            "home_avg_y": float(round(rec_df["home_y"].mean(), 2)),
            "away_avg_x": float(round(rec_df["away_x"].mean(), 2)),
            "away_avg_y": float(round(rec_df["away_y"].mean(), 2)),
            "avg_centroid_distance": float(round(dist_series.mean(), 2)),
            "min_centroid_distance": float(round(dist_series.min(), 2)),
            "max_centroid_distance": float(round(dist_series.max(), 2)),
            "min_distance_minute": float(rec_df.loc[min_idx, "minute"]),
            "max_distance_minute": float(rec_df.loc[max_idx, "minute"]),
        }

        return {"timeline": timeline, "summary": summary}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# Module-level cache for slow space control computation
_space_timeline_cache: dict = {}


@router.get("/{match_id}/space-control-timeline")
def get_space_control_timeline(match_id: int, sample_every: int = Query(50)):
    cache_key = f"{match_id}_{sample_every}"
    if cache_key in _space_timeline_cache:
        return _space_timeline_cache[cache_key]

    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)

        def get_team(pid):
            return player_lookup.get(pid, {}).get("team", "unknown")

        players_df = tracking_df[tracking_df["player_id"] != -1].copy()
        players_df["team"] = players_df["player_id"].apply(get_team)
        players_df = players_df.dropna(subset=["x_m", "y_m"])

        ball_df = tracking_df[tracking_df["player_id"] == -1][["frame", "x_m", "y_m"]].copy()
        ball_df = ball_df.rename(columns={"x_m": "ball_x", "y_m": "ball_y"}).dropna()

        periods = match_data.get("match_periods", [])

        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 2)
            if periods and frame_num > periods[-1]["end_frame"]:
                p = periods[-1]
                frames_into = frame_num - p["start_frame"]
                mins = frames_into / (10 * 60)
                if p["period"] == 2:
                    mins += 45
                return round(mins, 2)
            return 0.0

        all_frames = np.sort(players_df["frame"].unique())
        sampled_frames = all_frames[::sample_every]

        # Use a 10x6 grid (coarse) for fast Voronoi approximation
        grid_xs = np.linspace(0, 105, 21)
        grid_ys = np.linspace(0, 68, 14)
        gx, gy = np.meshgrid(grid_xs, grid_ys)
        grid_pts = np.column_stack([gx.ravel(), gy.ravel()])  # (N_grid, 2)

        timeline = []
        import logging
        log = logging.getLogger(__name__)

        for i, frame in enumerate(sampled_frames):
            if i % 100 == 0:
                log.info(f"Space control: processing frame {i}/{len(sampled_frames)}")

            group = players_df[players_df["frame"] == frame]
            home = group[group["team"] == "home"][["x_m", "y_m"]].values
            away = group[group["team"] == "away"][["x_m", "y_m"]].values

            if len(home) == 0 or len(away) == 0:
                continue

            all_pts = np.vstack([home, away])
            n_home = len(home)

            # For each grid cell, find closest player
            diffs = grid_pts[:, None, :] - all_pts[None, :, :]  # (G, P, 2)
            dists = np.sqrt((diffs ** 2).sum(axis=2))  # (G, P)
            nearest = dists.argmin(axis=1)  # (G,)

            home_cells = (nearest < n_home).sum()
            total_cells = len(grid_pts)
            home_pct = round(home_cells / total_cells * 100, 1)
            away_pct = round(100 - home_pct, 1)

            minute = get_match_minute(frame)

            # Ball zone
            ball_row = ball_df[ball_df["frame"] == frame]
            ball_x = float(ball_row["ball_x"].iloc[0]) if not ball_row.empty else 52.5
            ball_zone = "home_half" if ball_x < 52.5 else "away_half"

            timeline.append({
                "minute": minute,
                "frame": int(frame),
                "home_pct": home_pct,
                "away_pct": away_pct,
                "ball_zone": ball_zone,
            })

        if not timeline:
            raise HTTPException(status_code=404, detail="No data to compute")

        # Momentum blocks (5-minute windows)
        max_min = max(t["minute"] for t in timeline)
        momentum_blocks = []
        block_size = 5
        block_start = 0
        while block_start < max_min:
            block_end = block_start + block_size
            block_pts = [t for t in timeline if block_start <= t["minute"] < block_end]
            if block_pts:
                avg_home = round(sum(p["home_pct"] for p in block_pts) / len(block_pts), 1)
                if avg_home > 55:
                    label, dominant = "Home dominant", "home"
                elif avg_home < 45:
                    label, dominant = "Away dominant", "away"
                else:
                    label, dominant = "Contested", "contested"
                momentum_blocks.append({
                    "start_min": block_start,
                    "end_min": block_end,
                    "home_pct": avg_home,
                    "away_pct": round(100 - avg_home, 1),
                    "label": label,
                    "dominant_team": dominant,
                })
            block_start += block_size

        overall_home = round(sum(t["home_pct"] for t in timeline) / len(timeline), 1)
        overall_away = round(100 - overall_home, 1)
        home_dominant_mins = round(sum(block_size for b in momentum_blocks if b["dominant_team"] == "home"), 1)
        away_dominant_mins = round(sum(block_size for b in momentum_blocks if b["dominant_team"] == "away"), 1)

        # Most dominant period: block with max/min home_pct
        if momentum_blocks:
            top = max(momentum_blocks, key=lambda b: abs(b["home_pct"] - 50))
            most_dominant = f"{top['label']} in {top['start_min']}-{top['end_min']} min"
        else:
            most_dominant = "N/A"

        result = {
            "timeline": timeline,
            "momentum_blocks": momentum_blocks,
            "summary": {
                "overall_home_pct": overall_home,
                "overall_away_pct": overall_away,
                "home_dominant_minutes": home_dominant_mins,
                "away_dominant_minutes": away_dominant_mins,
                "most_dominant_period": most_dominant,
            }
        }

        _space_timeline_cache[cache_key] = result
        return result

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{match_id}/ball-trajectory")
def get_ball_trajectory(
    match_id: int,
    period: int = Query(1),
    start_minute: float = Query(0),
    end_minute: float = Query(5),
):
    # Cap window at 10 minutes
    if end_minute - start_minute > 10:
        end_minute = start_minute + 10

    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)

        ball_df = tracking_df[tracking_df["player_id"] == -1].copy()

        # Filter by period
        if period != 0 and "period" in ball_df.columns:
            ball_df = ball_df[ball_df["period"] == period]

        ball_df = ball_df.dropna(subset=["x_m", "y_m"])

        # Filter detected frames
        if "is_detected" in ball_df.columns:
            ball_df = ball_df[ball_df["is_detected"] == True]

        # Convert frame to minute
        periods = match_data.get("match_periods", [])

        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 4)
            return 0.0

        ball_df = ball_df.sort_values("frame").copy()
        ball_df["minute"] = ball_df["frame"].apply(get_match_minute)

        # Filter by minute range
        ball_df = ball_df[(ball_df["minute"] >= start_minute) & (ball_df["minute"] <= end_minute)]

        if ball_df.empty:
            return {"points": [], "stats": {}, "speed_distribution": {}}

        # Compute speed
        ball_df = ball_df.sort_values("frame").reset_index(drop=True)
        dx = ball_df["x_m"].diff().fillna(0)
        dy = ball_df["y_m"].diff().fillna(0)
        speed_ms = np.sqrt(dx**2 + dy**2) / 0.1
        speed_kmh = (speed_ms * 3.6).clip(0, 120)
        ball_df["speed_kmh"] = speed_kmh

        def classify_speed(s):
            if s < 10:
                return "SLOW"
            elif s < 40:
                return "MEDIUM"
            elif s < 80:
                return "FAST"
            else:
                return "VERY_FAST"

        ball_df["speed_class"] = ball_df["speed_kmh"].apply(classify_speed)

        # Detect touches via direction change > 90 degrees
        touches = 0
        vx = dx.values
        vy = dy.values
        for i in range(2, len(vx)):
            v1 = np.array([vx[i-1], vy[i-1]])
            v2 = np.array([vx[i], vy[i]])
            n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
            if n1 > 0.01 and n2 > 0.01:
                cos_a = np.clip(np.dot(v1, v2) / (n1 * n2), -1, 1)
                angle = np.degrees(np.arccos(cos_a))
                if angle > 90:
                    touches += 1

        # Distance covered
        dist_m = float(np.sqrt(dx**2 + dy**2).sum())

        total = len(ball_df)
        counts = ball_df["speed_class"].value_counts()

        points = []
        vx_arr = dx.values
        vy_arr = dy.values
        touch_frames = []
        for i in range(2, len(vx_arr)):
            v1 = np.array([vx_arr[i-1], vy_arr[i-1]])
            v2 = np.array([vx_arr[i], vy_arr[i]])
            n1b, n2b = np.linalg.norm(v1), np.linalg.norm(v2)
            if n1b > 0.01 and n2b > 0.01:
                cos_ab = np.clip(np.dot(v1, v2) / (n1b * n2b), -1, 1)
                angle_ab = np.degrees(np.arccos(cos_ab))
                if angle_ab > 90:
                    touch_frames.append(i - 1)

        # Build player lookup dict by pid for fast access
        # Get context players at start frame
        start_frame_num = int(ball_df.iloc[0]["frame"]) if not ball_df.empty else None
        context_players = []
        if start_frame_num is not None:
            players_at_start = tracking_df[
                (tracking_df["frame"] == start_frame_num) &
                (tracking_df["player_id"] != -1)
            ].dropna(subset=["x_m", "y_m"])
            for _, pr in players_at_start.iterrows():
                pid = int(pr["player_id"])
                pinfo = player_lookup.get(pid, {})
                context_players.append({
                    "player_id": pid,
                    "x_m": float(round(pr["x_m"], 2)),
                    "y_m": float(round(pr["y_m"], 2)),
                    "team": pinfo.get("team", "unknown"),
                    "last_name": pinfo.get("last_name", pinfo.get("name", str(pid))),
                })

        for idx_i, (_, row) in enumerate(ball_df.iterrows()):
            # Find nearest player at touch frames
            nearest_player_name = ""
            nearest_team = ""
            if idx_i in touch_frames:
                frame_num_t = int(row["frame"])
                bx_t, by_t = float(row["x_m"]), float(row["y_m"])
                players_at_touch = tracking_df[
                    (tracking_df["frame"] == frame_num_t) &
                    (tracking_df["player_id"] != -1)
                ].dropna(subset=["x_m", "y_m"])
                if not players_at_touch.empty:
                    dists_t = np.sqrt(
                        (players_at_touch["x_m"].values - bx_t)**2 +
                        (players_at_touch["y_m"].values - by_t)**2
                    )
                    nearest_pid = int(players_at_touch.iloc[dists_t.argmin()]["player_id"])
                    np_info = player_lookup.get(nearest_pid, {})
                    nearest_player_name = np_info.get("last_name", np_info.get("name", ""))
                    nearest_team = np_info.get("team", "")

            pt = {
                "minute": float(round(row["minute"], 3)),
                "x_m": float(round(row["x_m"], 2)),
                "y_m": float(round(row["y_m"], 2)),
                "speed_kmh": float(round(row["speed_kmh"], 1)),
                "speed_class": row["speed_class"],
            }
            if idx_i in touch_frames:
                pt["is_touch"] = True
                pt["nearest_player"] = nearest_player_name
                pt["nearest_team"] = nearest_team
            points.append(pt)

        max_idx = ball_df["speed_kmh"].idxmax()

        return {
            "points": points,
            "context_players": context_players,
            "stats": {
                "total_points": total,
                "avg_speed_kmh": float(round(ball_df["speed_kmh"].mean(), 1)),
                "max_speed_kmh": float(round(ball_df["speed_kmh"].max(), 1)),
                "max_speed_minute": float(round(ball_df.loc[max_idx, "minute"], 2)),
                "estimated_touches": touches,
                "distance_covered_m": float(round(dist_m, 1)),
            },
            "speed_distribution": {
                "slow_pct": round(counts.get("SLOW", 0) / total * 100, 1),
                "medium_pct": round(counts.get("MEDIUM", 0) / total * 100, 1),
                "fast_pct": round(counts.get("FAST", 0) / total * 100, 1),
                "very_fast_pct": round(counts.get("VERY_FAST", 0) / total * 100, 1),
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# Module-level cache for physical summary
_physical_cache: dict = {}


@router.get("/{match_id}/physical-summary")
def get_physical_summary(match_id: int):
    if match_id in _physical_cache:
        return _physical_cache[match_id]

    try:
        match_data, tracking_df, player_lookup = get_match_resources(match_id)

        SPEED_ZONES = [
            ("walking", 0, 2.0),
            ("jogging", 2.0, 4.0),
            ("running", 4.0, 5.5),
            ("high_speed", 5.5, 7.0),
            ("sprint", 7.0, 999),
        ]

        periods = match_data.get("match_periods", [])

        def get_match_minute(frame_num):
            for p in periods:
                if p["start_frame"] <= frame_num <= p["end_frame"]:
                    frames_into = frame_num - p["start_frame"]
                    mins = frames_into / (10 * 60)
                    if p["period"] == 2:
                        mins += 45
                    elif p["period"] > 2:
                        mins += 90
                    return round(mins, 2)
            return 0.0

        players_df = tracking_df[tracking_df["player_id"] != -1].copy()
        players_df = players_df.dropna(subset=["x_m", "y_m"])

        player_stats = []

        for pid, info in player_lookup.items():
            pdf = players_df[players_df["player_id"] == pid].sort_values("frame").copy()
            if len(pdf) < 10:
                continue

            dx = pdf["x_m"].diff().fillna(0).values
            dy = pdf["y_m"].diff().fillna(0).values
            dist_per_frame = np.sqrt(dx**2 + dy**2)

            # Clip teleport artifacts — max realistic human speed ~12 m/s (43 km/h)
            dist_per_frame = np.minimum(dist_per_frame, 1.2)
            speed_ms = dist_per_frame / 0.1

            # Accel
            accel = np.diff(speed_ms) / 0.1
            max_accel = float(np.max(np.abs(accel))) if len(accel) > 0 else 0.0

            total_dist = float(dist_per_frame.sum())

            # Period distances
            p1_mask = pdf["period"].values == 1 if "period" in pdf.columns else np.zeros(len(pdf), dtype=bool)
            p2_mask = pdf["period"].values == 2 if "period" in pdf.columns else np.zeros(len(pdf), dtype=bool)
            p1_dist = float(dist_per_frame[p1_mask].sum())
            p2_dist = float(dist_per_frame[p2_mask].sum())

            # Zone distances
            zone_dists = {}
            for name, low, high in SPEED_ZONES:
                mask = (speed_ms >= low) & (speed_ms < high)
                zone_dists[name + "_km"] = float(round(dist_per_frame[mask].sum() / 1000, 3))

            # Sprint events (consecutive frames > 7 m/s for >= 5)
            sprint_mask = (speed_ms > 7.0).astype(int)
            sprint_count = 0
            sprint_dist = 0.0
            in_sprint = False
            run_len = 0
            run_dist = 0.0
            for i, (sm, dm) in enumerate(zip(sprint_mask, dist_per_frame)):
                if sm:
                    in_sprint = True
                    run_len += 1
                    run_dist += dm
                else:
                    if in_sprint and run_len >= 5:
                        sprint_count += 1
                        sprint_dist += run_dist
                    in_sprint = False
                    run_len = 0
                    run_dist = 0.0
            if in_sprint and run_len >= 5:
                sprint_count += 1
                sprint_dist += run_dist

            # High intensity distance (> 5.5 m/s)
            hi_mask = speed_ms > 5.5
            hi_dist = float(dist_per_frame[hi_mask].sum())

            # Max speed
            max_speed_ms = float(np.max(speed_ms)) if len(speed_ms) > 0 else 0.0
            max_speed_kmh = round(max_speed_ms * 3.6, 1)
            max_frame_idx = int(np.argmax(speed_ms))
            max_frame = int(pdf.iloc[max_frame_idx]["frame"]) if max_frame_idx < len(pdf) else 0
            max_speed_minute = get_match_minute(max_frame)

            minutes_played = round(len(pdf) / (10 * 60), 1)

            player_stats.append({
                "player_id": pid,
                "name": info.get("name", str(pid)),
                "last_name": info.get("last_name", info.get("name", str(pid))),
                "team": info.get("team", "unknown"),
                "position": info.get("position", ""),
                "number": info.get("number", 0),
                "minutes_played": minutes_played,
                "total_distance_km": round(total_dist / 1000, 2),
                "p1_distance_km": round(p1_dist / 1000, 2),
                "p2_distance_km": round(p2_dist / 1000, 2),
                **zone_dists,
                "sprint_count": sprint_count,
                "total_sprint_distance_m": round(sprint_dist, 1),
                "high_intensity_distance_m": round(hi_dist, 1),
                "max_speed_kmh": max_speed_kmh,
                "max_speed_minute": max_speed_minute,
                "max_accel": round(max_accel, 2),
            })

        if not player_stats:
            raise HTTPException(status_code=404, detail="No player data found")

        # Team summaries
        home = [p for p in player_stats if p["team"] == "home"]
        away = [p for p in player_stats if p["team"] == "away"]

        def team_summary(players):
            if not players:
                return {}
            sorted_by_dist = sorted(players, key=lambda p: p["total_distance_km"], reverse=True)
            sorted_by_sprint = sorted(players, key=lambda p: p["sprint_count"], reverse=True)
            total_km = round(sum(p["total_distance_km"] for p in players), 2)
            avg_km = round(total_km / len(players), 2)
            return {
                "total_km": total_km,
                "avg_km": avg_km,
                "top_runner": {"name": sorted_by_dist[0]["name"], "km": sorted_by_dist[0]["total_distance_km"]},
                "top_sprinter": {"name": sorted_by_sprint[0]["name"], "count": sorted_by_sprint[0]["sprint_count"]},
            }

        all_sorted_dist = sorted(player_stats, key=lambda p: p["total_distance_km"], reverse=True)
        all_sorted_speed = sorted(player_stats, key=lambda p: p["max_speed_kmh"], reverse=True)
        all_sorted_sprint = sorted(player_stats, key=lambda p: p["sprint_count"], reverse=True)

        result = {
            "players": player_stats,
            "team_summary": {
                "home": team_summary(home),
                "away": team_summary(away),
            },
            "match_records": {
                "fastest_player": {"name": all_sorted_speed[0]["name"], "team": all_sorted_speed[0]["team"], "speed_kmh": all_sorted_speed[0]["max_speed_kmh"]} if all_sorted_speed else {},
                "most_distance": {"name": all_sorted_dist[0]["name"], "team": all_sorted_dist[0]["team"], "distance_km": all_sorted_dist[0]["total_distance_km"]} if all_sorted_dist else {},
                "most_sprints": {"name": all_sorted_sprint[0]["name"], "team": all_sorted_sprint[0]["team"], "count": all_sorted_sprint[0]["sprint_count"]} if all_sorted_sprint else {},
            }
        }

        _physical_cache[match_id] = result
        return result

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
