import requests
import json

API_KEY = "AIzaSyC5MnPE8i8iStXih2775YQMspW8SPujIJc"
URL = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={API_KEY}"

payload = {
    "input": {"text": "Ceci est un test de voix."},
    "voice": {"languageCode": "fr-FR", "name": "fr-FR-Neural2-B"},
    "audioConfig": {"audioEncoding": "MP3"}
}

try:
    response = requests.post(URL, json=payload)
    if response.status_code == 200:
        print("SUCCESS: API Key works for TTS.")
        # Content is base64 encoded, but we just need to know it worked
    else:
        print(f"ERROR: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"EXCEPTION: {e}")
