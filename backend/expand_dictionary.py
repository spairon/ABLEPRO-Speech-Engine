import os
import glob
import time
import json
import re
from collections import Counter
from pathlib import Path
import soundfile as sf

from services.transcription import get_whisper_model

DATASETS_DIR = Path("../Datasets")
OUTPUT_DICT = Path("kannada_corrections.json")

KANNADA_RE = re.compile(r'[\u0C80-\u0CFF]+')

# Known Hindi stopwords to drop
HINDI_STOPWORDS = {
    "hai", "hain", "kya", "nahi", "nahin", "haan", "aur", "ki", "ka", "ke",
    "ko", "se", "mein", "tha", "thi", "the", "bhi", "toh", "yeh", "woh",
    "kuch", "sab", "bahut", "accha", "theek", "matlab", "isliye", "lekin",
    "kyunki", "phir", "abhi", "pehle", "baad", "main", "mujhe", "tumhe",
    "unhe", "usse", "inhe", "apna", "apni", "apne", "ek", "do", "teen",
    "char", "paanch", "chhe", "saat", "aath", "nau", "das", "kaisa",
    "kaisi", "kaise", "kyun", "kab", "kahan", "kaun", "kitna", "kitni"
}

# Known common vattakshara fixes / ASR mistakes to seed the dictionary
COMMON_MISTAKES = {
    "ಮಾಡಿದಿಯಾ": "ಮಾಡಿದ್ದೀಯಾ",
    "ಹೋಗ್ತಿನಿ": "ಹೋಗುತ್ತಿದ್ದೇನೆ",
    "ಅಕ": "ಅಕ್ಕ",
    "ದೊಡ": "ದೊಡ್ಡ",
    "ಒಬ": "ಒಬ್ಬ",
    "ಇಲ": "ಇಲ್ಲ",
    "ಬಂದಿದಿನಿ": "ಬಂದಿದ್ದೇನೆ",
    "ಆಯತ": "ಆಯ್ತಾ",
    "ಮಾಡುತಿನಿ": "ಮಾಡುತ್ತೇನೆ"
}

def clean_kannada_word(word):
    # Extract only Kannada characters
    parts = KANNADA_RE.findall(word)
    return "".join(parts)

def build_phrases(words, n=2):
    phrases = []
    for i in range(len(words) - n + 1):
        phrases.append(" ".join(words[i:i+n]))
    return phrases

def main():
    print("Starting Kannada Dictionary Expansion...")
    if not DATASETS_DIR.exists():
        print(f"Datasets directory {DATASETS_DIR} not found.")
        return

    wav_files = list(DATASETS_DIR.glob("*.wav"))
    if not wav_files:
        print(f"No WAV files found in {DATASETS_DIR}.")
        return

    print(f"Found {len(wav_files)} audio files. Loading Whisper model...")
    model = get_whisper_model()
    
    word_counter = Counter()
    phrase_counter = Counter()
    
    start_time = time.time()
    
    for i, file_path in enumerate(wav_files):
        print(f"[{i+1}/{len(wav_files)}] Transcribing {file_path.name}...")
        try:
            # We can use Faster-Whisper directly
            segments, info = model.transcribe(
                str(file_path),
                language="kn",
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 300},
            )
            
            file_words = []
            for seg in segments:
                words = seg.text.strip().split()
                for w in words:
                    kw = clean_kannada_word(w)
                    if len(kw) > 1:
                        word_counter[kw] += 1
                        file_words.append(kw)
            
            # Extract frequent bigrams/phrases per file
            if file_words:
                phrases = build_phrases(file_words, 2)
                for p in phrases:
                    phrase_counter[p] += 1
                    
        except Exception as e:
            print(f"Error transcribing {file_path.name}: {e}")

    total_time = time.time() - start_time
    print(f"\nFinished processing in {total_time:.2f} seconds.")
    print(f"Extracted {len(word_counter)} unique words and {len(phrase_counter)} unique phrases.")
    
    # Load existing dictionary if any to preserve manual corrections
    final_dict = {}
    if OUTPUT_DICT.exists():
        try:
            with open(OUTPUT_DICT, "r", encoding="utf-8") as f:
                final_dict = json.load(f)
        except Exception:
            pass

    # Add Hindi stopwords mapping to empty string (to be removed)
    for hw in HINDI_STOPWORDS:
        if hw not in final_dict:
            final_dict[hw] = ""

    # Add common mistakes seeded above
    for wrong, correct in COMMON_MISTAKES.items():
        if wrong not in final_dict:
            final_dict[wrong] = correct

    # Add frequent valid Kannada words (so they pass through unmodified)
    for word, count in word_counter.items():
        if count >= 2: # Appeared at least twice
            if word not in final_dict:
                # We map correct words to themselves to prevent them from being dropped
                final_dict[word] = word
                
    # Add frequent phrases
    for phrase, count in phrase_counter.items():
        if count >= 3:
            if phrase not in final_dict:
                final_dict[phrase] = phrase

    # Save dictionary
    with open(OUTPUT_DICT, "w", encoding="utf-8") as f:
        json.dump(final_dict, f, ensure_ascii=False, indent=2)
        
    print(f"Saved {len(final_dict)} entries to {OUTPUT_DICT}.")
    print("The backend will automatically pick this up on restart or via the reload_dictionary() function.")

if __name__ == "__main__":
    main()
