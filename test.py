import requests

# Create a minimal valid wav file
with open("test.wav", "wb") as f:
    f.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")

try:
    response = requests.post("http://localhost:8000/api/analyze", files={"file": ("test.wav", open("test.wav", "rb"), "audio/wav")})
    print("Status:", response.status_code)
    try:
        print("Response:", response.json())
    except:
        print("Text Response:", response.text)
except Exception as e:
    print("Request failed:", e)
