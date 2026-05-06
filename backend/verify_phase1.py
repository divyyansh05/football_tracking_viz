import sys
from pathlib import Path
import pandas as pd

# Add backend to path
sys.path.append(str(Path.cwd()))

from core.data_loader import resolve_tracking_path, load_tracking_data, load_match_metadata

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
MATCH_ID = 2062143

print(f"Resolving path for {MATCH_ID}...")
jsonl_path = resolve_tracking_path(RAW_DIR, MATCH_ID)
print(f"Found: {jsonl_path}")

print("Testing metadata load...")
meta = load_match_metadata(RAW_DIR / f"{MATCH_ID}_match_data.json")
print(f"Match: {meta['home_team']['name']} vs {meta['away_team']['name']}")

print("Testing tracking load (first 100 lines test)...")
# We'll just run the real thing but let it finish
df = load_tracking_data(jsonl_path, PROCESSED_DIR, MATCH_ID)
print(f"Loaded {len(df)} rows.")
print("Columns:", df.columns.tolist())
