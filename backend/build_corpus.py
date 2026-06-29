import os
import sys
import json
import logging
import re
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.transcription import get_whisper_model

DATASETS_DIR = Path("../Datasets")
OUTPUT_DICT = Path("kannada_corrections.json")
KANNADA_RE = re.compile(r'[\u0C80-\u0CFF]+')

def main():
    logger.info("Starting Vocabulary Corpus Builder...")
    if not DATASETS_DIR.exists():
        logger.error(f"Directory {DATASETS_DIR} not found.")
        return

    wav_files = list(DATASETS_DIR.glob("*.wav"))
    if not wav_files:
        logger.warning(f"No wav files found in {DATASETS_DIR}.")
        return

    logger.info("Loading local Whisper model...")
    model = get_whisper_model()
    
    corpus_words = {}
    
    for i, file_path in enumerate(wav_files):
        logger.info(f"Processing {i+1}/{len(wav_files)}: {file_path.name}")
        try:
            segments, info = model.transcribe(
                str(file_path),
                language="kn",
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 300},
            )
            for seg in segments:
                words = seg.text.strip().split()
                for w in words:
                    # Extract only Kannada characters
                    kannada_parts = KANNADA_RE.findall(w)
                    for clean_w in kannada_parts:
                        if len(clean_w) > 1:
                            corpus_words[clean_w] = corpus_words.get(clean_w, 0) + 1
        except Exception as e:
            logger.error(f"Failed to transcribe {file_path.name}: {e}")

    logger.info(f"Corpus building complete. Extracted {len(corpus_words)} unique words.")
    
    # Build the dictionary mapping high frequency words to themselves (or retaining old mappings)
    # This acts as an allowed vocabulary list for the correction pipeline.
    final_dict = {}
    if OUTPUT_DICT.exists():
        with open(OUTPUT_DICT, "r", encoding="utf-8") as f:
            final_dict = json.load(f)

    for word, count in corpus_words.items():
        if count >= 2: # Keep frequent words
            if word not in final_dict:
                final_dict[word] = word
            
    with open(OUTPUT_DICT, "w", encoding="utf-8") as f:
        json.dump(final_dict, f, ensure_ascii=False, indent=2)
        
    logger.info(f"Saved {len(final_dict)} words to {OUTPUT_DICT}")

if __name__ == "__main__":
    main()
