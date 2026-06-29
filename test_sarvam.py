# coding: utf-8
"""
Quick smoke test for the Sarvam saaras:v3 API.
Generates a 440Hz tone WAV and sends it to verify auth + connectivity.
"""
import os, sys, io, struct, math, requests

API_KEY = "sk_xm51r8rz_Hk1FSqzA3Ag8WaQTvbam1U7O"
URL     = "https://api.sarvam.ai/speech-to-text"
MODEL   = "saaras:v3"
LANG    = "kn-IN"

# Generate a 1-second 440 Hz tone WAV at 16kHz PCM-16 (gives non-empty audio)
def make_tone_wav(freq=440, duration=1.0, sr=16000):
    n_samples = int(sr * duration)
    samples = [int(32767 * math.sin(2 * math.pi * freq * i / sr)) for i in range(n_samples)]
    raw = struct.pack(f"<{n_samples}h", *samples)

    buf = io.BytesIO()
    # RIFF header
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + len(raw)))   # chunk size
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))               # subchunk size
    buf.write(struct.pack("<H", 1))                # PCM
    buf.write(struct.pack("<H", 1))                # mono
    buf.write(struct.pack("<I", sr))               # sample rate
    buf.write(struct.pack("<I", sr * 2))           # byte rate
    buf.write(struct.pack("<H", 2))                # block align
    buf.write(struct.pack("<H", 16))               # bits per sample
    buf.write(b"data")
    buf.write(struct.pack("<I", len(raw)))
    buf.write(raw)
    buf.seek(0)
    return buf.read()

wav = make_tone_wav()
print(f"Sending {len(wav)} byte WAV to Sarvam {MODEL} ({LANG})…")

resp = requests.post(
    URL,
    headers={"api-subscription-key": API_KEY},
    files={"file": ("test_tone.wav", wav, "audio/wav")},
    data={"model": MODEL, "language_code": LANG, "with_timestamps": "true"},
    timeout=30,
)

print(f"Status: {resp.status_code}")
try:
    j = resp.json()
    print("Response:", j)
    if resp.status_code == 200:
        print("\n✅ API key valid, model reachable!")
        print("   Transcript:", j.get("transcript", "(empty — tone has no speech)"))
    else:
        print("\n❌ Error:", j)
        sys.exit(1)
except Exception:
    print("Raw text:", resp.text)
    sys.exit(1)
