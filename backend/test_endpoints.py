import urllib.request
import json
import time

base_url = "http://127.0.0.1:8000/api"
match_id = 2062143

def fetch(path):
    req = urllib.request.Request(f"{base_url}{path}")
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return 500, str(e)

print(fetch(f"/match/{match_id}/status"))
