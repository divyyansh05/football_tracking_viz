import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000"

def get_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        return response.status, json.loads(response.read().decode())

def test_endpoints():
    try:
        # 1. Health check
        print("Testing /health...")
        status, data = get_json(f"{BASE_URL}/health")
        assert status == 200, f"Health check failed: {status}"
        assert "status" in data, "Invalid health response"

        # 2. List matches
        print("Testing /api/match/list...")
        status, data = get_json(f"{BASE_URL}/api/match/list")
        assert status == 200, f"Match list failed: {status}"
        assert "matches" in data, "No matches key in response"
        
        matches = data["matches"]
        if not matches:
            print("No matches available to test further. Exiting successfully.")
            return
            
        match_id = matches[0]["match_id"]
        print(f"Using match ID: {match_id}")

        # 3. Metadata
        print(f"Testing /api/match/{match_id}/metadata...")
        status, meta = get_json(f"{BASE_URL}/api/match/{match_id}/metadata")
        assert status == 200, f"Metadata failed: {status}"
        assert "home_team" in meta and "away_team" in meta, "Invalid metadata response"
        
        # 4. Frame 100
        print(f"Testing /api/match/{match_id}/frame/100...")
        status, frame_data = get_json(f"{BASE_URL}/api/match/{match_id}/frame/100")
        assert status == 200, f"Frame failed: {status}"
        assert "players" in frame_data and "ball" in frame_data, "Invalid frame response"
        
        # 5. Pitch control 100
        print(f"Testing /api/match/{match_id}/pitch-control/100...")
        status, pc_data = get_json(f"{BASE_URL}/api/match/{match_id}/pitch-control/100")
        assert status == 200, f"Pitch control failed: {status}"
        assert "home_pct" in pc_data and "summary" in pc_data, "Invalid pitch control response"

        print("All integration tests passed successfully!")
        sys.exit(0)
    except AssertionError as e:
        print(f"Test assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Test execution failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_endpoints()
