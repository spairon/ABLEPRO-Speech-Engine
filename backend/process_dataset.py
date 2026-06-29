import os
import glob
import time
import json
from collections import Counter
import re
from faster_whisper import WhisperModel
import sys
import soundfile as sf
import numpy as np

# Ensure services module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.kannada_dictionary import apply_dictionary_correction, load_custom_dictionary

DATASETS_DIR = "../Datasets"
REPORT_PATH = "vocabulary_report.md"
CORRECTIONS_PATH = "kannada_corrections.json"

def process_datasets():
    print("Loading Faster-Whisper medium on CUDA...")
    try:
        model = WhisperModel("medium", device="cuda", compute_type="float16")
    except Exception as e:
        print(f"Failed to load medium model on CUDA: {e}")
        print("Falling back to small model on CPU for testing...")
        model = WhisperModel("small", device="cpu", compute_type="int8")
        
    wav_files = glob.glob(os.path.join(DATASETS_DIR, "*.wav"))
    print(f"Found {len(wav_files)} audio files.")
    
    all_raw_text = ""
    all_corrected_text = ""
    correction_logs = []
    
    start_time = time.time()
    
    # Load dictionary once
    dictionary = load_custom_dictionary()
    print(f"Loaded dictionary with {len(dictionary)} entries.")
    
    for i, wav_file in enumerate(wav_files):
        print(f"[{i+1}/{len(wav_files)}] Transcribing {os.path.basename(wav_file)}...")
        try:
            # Load audio manually to bypass ffmpeg requirement for openai-whisper
            audio_data, sample_rate = sf.read(wav_file, dtype="float32", always_2d=True)
            audio_mono = audio_data.mean(axis=1)
            # Assuming 16k is standard for these, otherwise resample (whisper needs 16k)
            # In hackathon dataset they usually are 16k.
            if sample_rate != 16000:
                print(f"Warning: sample rate is {sample_rate}, whisper expects 16000")
                
            segments, info = model.transcribe(audio_mono, language="kn", beam_size=5)
            
            raw_segments = [{"text": s.text.strip()} for s in segments if s.text.strip()]
            all_raw_text += " " + " ".join([s["text"] for s in raw_segments])
            
            # Apply Dictionary
            corrected_segments = apply_dictionary_correction(raw_segments, dictionary)
            
            for seg in corrected_segments:
                all_corrected_text += " " + seg["text"]
                if "corrections" in seg and seg["corrections"]:
                    correction_logs.extend(seg["corrections"])
                    
        except Exception as e:
            print(f"Error processing {wav_file}: {e}")
            
    total_time = time.time() - start_time
    print(f"Processed all files in {total_time:.2f} seconds.")
    
    # Vocabulary Analysis (Raw)
    clean_raw_text = re.sub(r'[^\w\s\u0C80-\u0CFF]', '', all_raw_text)
    raw_words = clean_raw_text.split()
    total_raw_words = len(raw_words)
    raw_word_counts = Counter(raw_words)
    unique_raw_words = len(raw_word_counts)
    
    # Applied Corrections Stats
    total_corrections_applied = len(correction_logs)
    correction_mapping_counts = Counter([(log["original"], log["corrected"]) for log in correction_logs])
    
    # Improvement calculation
    improvement_percentage = (total_corrections_applied / max(1, total_raw_words)) * 100
    
    # Generate report
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("# Kannada Vocabulary & Correction Report\n\n")
        f.write(f"**Total files processed:** {len(wav_files)}\n")
        f.write(f"**Total processing time:** {total_time:.2f} seconds\n")
        f.write(f"**Transcription Speed:** {(total_raw_words / max(1, total_time)):.2f} words/sec\n")
        f.write(f"**Total raw words transcribed:** {total_raw_words}\n")
        f.write(f"**Unique vocabulary size:** {unique_raw_words}\n\n")
        
        f.write("## Improvement Statistics\n")
        f.write(f"- **Total corrections applied:** {total_corrections_applied}\n")
        f.write(f"- **Correction density:** {improvement_percentage:.2f}% of words required correction.\n")
        f.write("- **API calls bypassed:** 100% (Fully local pipeline)\n\n")
        
        f.write("## Most Common Correction Mappings Applied\n")
        f.write("| Original (Wrong) | Corrected | Occurrences |\n")
        f.write("| :--- | :--- | :--- |\n")
        for (orig, corr), count in correction_mapping_counts.most_common(50):
            corr_text = corr if corr else "*(Removed)*"
            f.write(f"| {orig} | {corr_text} | {count} |\n")
            
        f.write("\n## Most Common Kannada Words (Raw)\n")
        f.write("| Word | Frequency |\n")
        f.write("| :--- | :--- |\n")
        for word, count in raw_word_counts.most_common(100):
            if word.strip():
                f.write(f"| {word} | {count} |\n")
                
    # Initial manual defaults (can be overridden by frontend)
    with open(CORRECTIONS_PATH, "r", encoding="utf-8") as f:
        try:
            corrections = json.load(f)
        except:
            corrections = {}
        
    corrections["ಮಾಡಿದಿಯಾ"] = "ಮಾಡಿದ್ದೀಯಾ"
    corrections["ಹೋಗ್ತಿನಿ"] = "ಹೋಗುತ್ತಿದ್ದೇನೆ"
    
    with open(CORRECTIONS_PATH, "w", encoding="utf-8") as f:
        json.dump(corrections, f, ensure_ascii=False, indent=2)
        
    print(f"\nVocabulary size: {unique_raw_words}")
    print(f"Total corrections applied: {total_corrections_applied}")
    print(f"Report saved to {REPORT_PATH}")

if __name__ == "__main__":
    process_datasets()
