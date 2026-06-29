"""
kannada_dictionary.py
---------------------
Stage 3 of the transcription pipeline.

Loads a custom Kannada word-correction dictionary from `kannada_corrections.json`
and applies it as a fast pre-pass on raw STT segments BEFORE sending them to the LLM.

Dictionary format: { "wrong_stt_word": "correct_kannada_word" }
  - Empty-string value  → the word is removed (i.e. a Hindi intrusion or noise)
  - Non-empty value     → the word is replaced with the correct spelling

How to extend:
  Edit `backend/kannada_corrections.json` and add your own entries.
  No code change needed — the file is reloaded on every backend restart.
"""

import json
import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# Path to the dictionary JSON, co-located with backend/
_DICT_PATH = Path(__file__).parent.parent / "kannada_corrections.json"

# Module-level cache
_dictionary: dict | None = None
_phrase_dict: dict = {}
_word_dict: dict = {}


def load_custom_dictionary() -> dict:
    """
    Load (and cache) the correction dictionary from kannada_corrections.json.
    Returns an empty dict if the file is not found or is invalid.
    """
    global _dictionary, _phrase_dict, _word_dict
    if _dictionary is not None:
        return _dictionary

    if not _DICT_PATH.exists():
        logger.warning(
            f"kannada_corrections.json not found at {_DICT_PATH}. "
            "Dictionary correction will be skipped."
        )
        _dictionary = {}
        _phrase_dict = {}
        _word_dict = {}
        return _dictionary

    try:
        with open(_DICT_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)

        # Strip internal comment keys (keys starting with "_")
        _dictionary = {k: v for k, v in raw.items() if not k.startswith("_")}
        
        # Split into phrases (spaces) and single words
        _phrase_dict = {k: v for k, v in _dictionary.items() if " " in k}
        _word_dict = {k: v for k, v in _dictionary.items() if " " not in k}
        
        logger.info(
            f"Loaded {len(_dictionary)} entries from kannada_corrections.json "
            f"({len(_phrase_dict)} phrases, {len(_word_dict)} words)"
        )
    except Exception as e:
        logger.error(f"Failed to load kannada_corrections.json: {e}")
        _dictionary = {}
        _phrase_dict = {}
        _word_dict = {}

    return _dictionary


def reload_dictionary() -> dict:
    """Force a reload of the dictionary from disk (useful for hot-reload workflows)."""
    global _dictionary, _phrase_dict, _word_dict
    _dictionary = None
    _phrase_dict = {}
    _word_dict = {}
    return load_custom_dictionary()


def _apply_to_text(text: str, dictionary: dict) -> tuple[str, list]:
    """
    Apply dictionary substitutions to a single text string.

    Returns:
        (corrected_text, list_of_applied_corrections)
    """
    if not text or not dictionary:
        return text, []

    applied_logs = []
    
    # 1. Apply Phrase substitutions first (sorted by length descending to match longest first)
    # We rely on simple string replacement for phrases, padded with spaces to match word boundaries roughly.
    if _phrase_dict:
        sorted_phrases = sorted(_phrase_dict.keys(), key=lambda x: len(x), reverse=True)
        for phrase in sorted_phrases:
            if phrase in text:
                replacement = _phrase_dict[phrase]
                text = text.replace(phrase, replacement)
                applied_logs.append({
                    "original": phrase,
                    "corrected": replacement,
                    "confidence": 0.98
                })

    # 2. Tokenise on whitespace for single word replacements
    tokens = text.split()
    result_tokens = []

    for token in tokens:
        # Strip leading/trailing punctuation for lookup but preserve it
        stripped = token.strip(".,!?;:\"'()[]{}।॥")
        prefix = token[: len(token) - len(token.lstrip(".,!?;:\"'()[]{}।॥"))]
        suffix = token[len(stripped) + len(prefix) :]

        if stripped in _word_dict:
            replacement = _word_dict[stripped]
            if replacement == "":
                # Drop the token (e.g. Hindi intrusion)
                applied_logs.append({
                    "original": stripped,
                    "corrected": "",
                    "confidence": 0.99
                })
            else:
                # Replace the token
                result_tokens.append(prefix + replacement + suffix)
                applied_logs.append({
                    "original": stripped,
                    "corrected": replacement,
                    "confidence": 0.95
                })
        else:
            result_tokens.append(token)

    # Clean up any double spaces introduced by empty string replacements
    final_text = " ".join(result_tokens).replace("  ", " ").strip()
    return final_text, applied_logs


def apply_dictionary_correction(segments: list, dictionary: dict | None = None) -> list:
    """
    Apply the custom correction dictionary to a list of transcript segments.

    Each segment is a dict with at least {'text': str}.
    Timestamps and speaker labels are never modified.

    Args:
        segments:   List of segment dicts from the STT engine.
        dictionary: Optional pre-loaded dict. Loads from disk if None.

    Returns:
        New list of segment dicts with corrected 'text' fields.
    """
    if dictionary is None:
        dictionary = load_custom_dictionary()

    if not dictionary:
        logger.info("Dictionary is empty — skipping dictionary correction pass.")
        return segments

    corrected = []
    changes = 0

    for seg in segments:
        original_text = seg.get("text", "")
        corrected_text, logs = _apply_to_text(original_text, dictionary)

        if corrected_text != original_text:
            changes += 1

        corrected.append({
            **seg, 
            "text": corrected_text,
            "corrections": logs
        })

    logger.info(
        f"Dictionary correction: processed {len(segments)} segments, "
        f"modified {changes} segment(s)."
    )
    return corrected


def get_dictionary_stats() -> dict:
    """Return stats about the loaded dictionary (for logging/debugging)."""
    d = load_custom_dictionary()
    removals = sum(1 for v in d.values() if v == "")
    replacements = len(d) - removals
    return {
        "total_entries": len(d),
        "replacements": replacements,
        "removals": removals,
        "path": str(_DICT_PATH),
    }
