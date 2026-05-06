#!/usr/bin/env python3
"""
test_api.py — Simple API Test Script

Tests all Football Tracking API endpoints.
Server must be running on http://localhost:8000

Run with: python test_api.py
"""

import json
import sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError, URLError


BASE_URL = "http://localhost:8000"
PASSED = 0
FAILED = 0


def test_endpoint(name: str, url: str, expected_status: int = 200) -> None:
    """Test a single endpoint and print result."""
    global PASSED, FAILED

    try:
        with urlopen(url, timeout=10) as response:
            status = response.status
            body = response.read().decode("utf-8")

            if status == expected_status:
                print(f"✓ PASS | {name}")
                print(f"  Status: {status}")
                print(f"  Response: {body[:200]}")
                PASSED += 1
            else:
                print(f"✗ FAIL | {name}")
                print(f"  Expected status {expected_status}, got {status}")
                print(f"  Response: {body[:200]}")
                FAILED += 1

    except HTTPError as exc:
        if exc.code == expected_status:
            print(f"✓ PASS | {name}")
            print(f"  Status: {exc.code} (expected)")
            PASSED += 1
        else:
            print(f"✗ FAIL | {name}")
            print(f"  Expected status {expected_status}, got {exc.code}")
            print(f"  Error: {exc.read().decode('utf-8')[:200]}")
            FAILED += 1

    except URLError as exc:
        print(f"✗ FAIL | {name}")
        print(f"  Connection error: {exc}")
        FAILED += 1

    except Exception as exc:
        print(f"✗ FAIL | {name}")
        print(f"  Unexpected error: {exc}")
        FAILED += 1

    print()


def find_match_id() -> int | None:
    """Scan data/raw/ for a match ID."""
    raw_dir = Path("data/raw")

    if not raw_dir.exists():
        return None

    for json_file in raw_dir.glob("*_match_data.json"):
        try:
            match_id = int(json_file.stem.replace("_match_data", ""))
            return match_id
        except ValueError:
            continue

    return None


def main():
    print("=" * 70)
    print("Football Tracking API Test Suite")
    print("=" * 70)
    print()

    # ── Test 1: Health check ──────────────────────────────────────────────────
    test_endpoint("GET /health", f"{BASE_URL}/health")

    # ── Test 2: Match list ────────────────────────────────────────────────────
    test_endpoint("GET /api/match/list", f"{BASE_URL}/api/match/list")

    # ── Find a match ID ───────────────────────────────────────────────────────
    match_id = find_match_id()

    if match_id is None:
        print("⚠️  No match data found in data/raw/")
        print("   Upload match files or place them in data/raw/ to test match endpoints.")
        print()
        print(f"Total: {PASSED} PASSED, {FAILED} FAILED")
        sys.exit(0)

    print(f"Found match_id={match_id} — testing match endpoints...")
    print()

    # ── Test 3: Match metadata ────────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/metadata",
        f"{BASE_URL}/api/match/{match_id}/metadata",
    )

    # ── Test 4: Single frame ──────────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/frame/6020",
        f"{BASE_URL}/api/match/{match_id}/frame/6020",
    )

    # ── Test 5: Voronoi ───────────────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/voronoi/6020",
        f"{BASE_URL}/api/match/{match_id}/voronoi/6020",
    )

    # ── Test 6: Pitch control ─────────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/pitch-control/6020",
        f"{BASE_URL}/api/match/{match_id}/pitch-control/6020",
    )

    # ── Test 7: Player stats ──────────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/players/6020/stats",
        f"{BASE_URL}/api/match/{match_id}/players/6020/stats",
    )

    # ── Test 8: Available frames ──────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/available-frames",
        f"{BASE_URL}/api/match/{match_id}/available-frames",
    )

    # ── Test 9: Batch frames ──────────────────────────────────────────────────
    test_endpoint(
        f"GET /api/match/{match_id}/frames?from_frame=6020&to_frame=6030",
        f"{BASE_URL}/api/match/{match_id}/frames?from_frame=6020&to_frame=6030",
    )

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 70)
    print(f"Total: {PASSED} PASSED, {FAILED} FAILED")
    print("=" * 70)

    if FAILED > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
