"""
models.py — Pydantic Response Models

All API response schemas for the Football Tracking Analytics API.
"""

from typing import List, Optional

from pydantic import BaseModel


# ─── Team Models ──────────────────────────────────────────────────────────────
class TeamInfo(BaseModel):
    id: int
    name: str
    short_name: str
    jersey_color: str
    number_color: str


# ─── Player Models ────────────────────────────────────────────────────────────
class PlayerInfo(BaseModel):
    id: int
    name: str
    last_name: str
    team_id: int
    team: str  # "home" or "away"
    number: Optional[int] = None
    position: str
    position_full: str


# ─── Period Models ────────────────────────────────────────────────────────────
class PeriodInfo(BaseModel):
    period: int
    start_frame: int
    end_frame: int
    duration_minutes: float


# ─── Match Metadata ───────────────────────────────────────────────────────────
class MatchMetadata(BaseModel):
    match_id: int
    home_team: TeamInfo
    away_team: TeamInfo
    home_score: int
    away_score: int
    date: str
    stadium: dict
    competition: str
    season: str
    round: str
    match_periods: List[PeriodInfo]
    players: List[PlayerInfo]


# ─── Frame Data Models ────────────────────────────────────────────────────────
class PlayerFrameData(BaseModel):
    player_id: int
    name: str
    last_name: str
    team_id: int
    team: str
    x_m: float
    y_m: float
    speed: float
    accel: float
    direction_deg: float
    is_detected: bool


class BallData(BaseModel):
    x_m: float
    y_m: float


class FrameResponse(BaseModel):
    frame: int
    time: dict
    players: List[PlayerFrameData]
    ball: Optional[BallData] = None


# ─── Pitch Control ────────────────────────────────────────────────────────────
class PitchControlResponse(BaseModel):
    frame: int
    home_pct: List[List[float]]
    x_coords: List[float]
    y_coords: List[float]
    summary: dict


# ─── Voronoi Models ───────────────────────────────────────────────────────────
class VoronoiRegion(BaseModel):
    player_id: int
    name: str
    team_id: int
    team: str
    color: str
    polygon: List[List[float]]  # [[x,y], [x,y], ...]
    area_m2: float


class VoronoiResponse(BaseModel):
    frame: int
    regions: List[VoronoiRegion]
    summary: dict


# ─── Match List ───────────────────────────────────────────────────────────────
class MatchListItem(BaseModel):
    match_id: int
    home_team: str
    away_team: str
    date: str
    score: str
    has_tracking: bool


class MatchListResponse(BaseModel):
    matches: List[MatchListItem]


# ─── Player Stats ─────────────────────────────────────────────────────────────
class PlayerStat(BaseModel):
    player_id: int
    name: str
    team: str
    speed_kmh: float
    accel: float
    direction_deg: float


class PlayerStatsResponse(BaseModel):
    frame: int
    player_stats: List[PlayerStat]


# ─── Available Frames ─────────────────────────────────────────────────────────
class AvailableFramesResponse(BaseModel):
    total_frames: int
    first_frame: int
    last_frame: int
    periods: List[dict]


# ─── Batch Frames ─────────────────────────────────────────────────────────────
class MinimalPlayerFrame(BaseModel):
    player_id: int
    x_m: float
    y_m: float


class MinimalBallFrame(BaseModel):
    x_m: float
    y_m: float


class MinimalFrame(BaseModel):
    frame: int
    players: List[MinimalPlayerFrame]
    ball: Optional[MinimalBallFrame] = None


class BatchFramesResponse(BaseModel):
    frames: List[MinimalFrame]
