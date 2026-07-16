
import urllib.request, json, urllib.error

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
data = json.dumps({"contents":[{"parts":[{"text":"hi"}]}]}).encode()
req = urllib.request.Request(url, data=data, headers={
    "Content-Type": "application/json",
    "x-goog-api-key": "AQ.Ab8RN6JUYpqAPOL1n6Ln6HrCH8Ij8xCv0G8YGIlabq0jLcivfg"
})

try:
    resp = urllib.request.urlopen(req)
    print(resp.read())
except urllib.error.HTTPError as e:
    print("STATUS:", e.code)
    print("BODY:", e.read().decode())
