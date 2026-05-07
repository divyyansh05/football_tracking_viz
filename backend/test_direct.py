import sys
import os

# Ensure backend is in path
sys.path.append(os.path.abspath('.'))

from routers.match import get_match_status, get_pitch_control
from routers.analytics import get_formation, get_ball_trajectory
import asyncio

match_id = 2062143

def test_status():
    print("Testing get_match_status...")
    try:
        res = get_match_status(match_id)
        print("Success:", res)
    except Exception as e:
        print("Error:", e)

def test_pitch_control():
    print("\nTesting get_pitch_control...")
    try:
        res = get_pitch_control(match_id, 6020)
        print(f"Success: frame={res.frame}, box_control={res.box_control}")
        
        print("Testing pitch_control cache...")
        res2 = get_pitch_control(match_id, 6020)
        print(f"Cache hit success: {res2.frame == 6020}")
    except Exception as e:
        print("Error:", e)

def test_formation():
    print("\nTesting get_formation...")
    try:
        res = get_formation(match_id, window_minutes=5, period=1)
        print(f"Success: total_windows={res['total_windows']}")
        if res['total_windows'] > 0:
            w = res['windows'][0]
            print(f"Home formation: {w['home_formation']}, Away formation: {w['away_formation']}")
    except Exception as e:
        print("Error:", e)

def test_trajectory():
    print("\nTesting get_ball_trajectory...")
    try:
        res = get_ball_trajectory(match_id, period=1, start_minute=0, end_minute=5)
        print(f"Success: points={len(res['points'])}, context_players={len(res.get('context_players', []))}")
        touch = [p for p in res['points'] if p.get('is_touch')]
        if touch:
            print(f"Touch detected, nearest={touch[0].get('nearest_player')} ({touch[0].get('nearest_team')})")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_status()
    test_pitch_control()
    test_formation()
    test_trajectory()
