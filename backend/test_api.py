import urllib.request
import json

url = "http://127.0.0.1:8000/health"
req = urllib.request.Request(url)

try:
    with urllib.request.urlopen(req) as response:
        print(f"Health Status Code: {response.getcode()}")
        print(response.read().decode())
except Exception as e:
    print(f"Health Exception: {e}")

url2 = "http://127.0.0.1:8000/api/v1/report/intro"
data2 = json.dumps({"file_hash": "test"}).encode("utf-8")
headers = {"Content-Type": "application/json"}
req2 = urllib.request.Request(url2, data=data2, headers=headers)

try:
    with urllib.request.urlopen(req2) as response:
        print(f"Report Status Code: {response.getcode()}")
        print(response.read().decode())
except urllib.error.URLError as e:
    print(f"Report URLError: {e}")
except Exception as e:
    print(f"Report Exception: {e}")
