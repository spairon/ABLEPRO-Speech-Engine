import requests

try:
    print("Testing backend...")
    with open("problem satement.md", "rb") as f: # Just sending a dummy file as .wav to trigger failure or dummy output
        pass # Actually we need a valid wav file or it'll fail at librosa
except Exception as e:
    pass
