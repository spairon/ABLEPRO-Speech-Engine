"""
transcription.py
----------------
Optimised Whisper STT pipeline for RTX 4050 (6 GB VRAM).

Key optimisations
  - Whisper model loaded ONCE at module import / startup; never reloaded
    per request.
  - CUDA float16 inference via Faster-Whisper.
  - Lightweight noise reduction (noisereduce) before STT; auto-skipped for
    good-quality audio (SNR >= DENOISE_SNR_SKIP_DB).
  - LLM correction disabled by default (SKIP_LLM_CORRECTION=true /
    CORRECTION_PROVIDER=none).  Only activates when confidence falls below
    CONFIDENCE_THRESHOLD and SKIP_LLM_CORRECTION=false.
  - Full per-stage profiling table printed to the log after every request.
  - Accepts a pre-loaded numpy array (audio_array) from the caller to avoid
    duplicate disk I/O.
"""

import gc
import json
import logging
import os
import re
import time

import numpy as np
import soundfile as sf

from services.gpu_utils import DEVICE, COMPUTE_TYPE, IS_CUDA

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
WHISPER_MODEL_SIZE   = os.getenv("WHISPER_MODEL_SIZE", "medium")
ENABLE_DENOISING     = os.getenv("ENABLE_DENOISING",      "true").lower() == "true"
DENOISE_SNR_SKIP_DB  = float(os.getenv("DENOISE_SNR_SKIP_THRESHOLD", "20.0"))

# Target sample rate for Whisper
WHISPER_SR = 16_000


# ── Whisper ────────────────────────────────────────────────────────────────────
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    t0 = time.perf_counter()
    from faster_whisper import WhisperModel
    logger.info(f"Loading local Whisper model ({WHISPER_MODEL_SIZE}) on {DEVICE}...")
    _whisper_model = WhisperModel(
        model_size_or_path=WHISPER_MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        cpu_threads=4,
    )
    elapsed = time.perf_counter() - t0
    logger.info(f"✅ Local Whisper model loaded in {elapsed:.2f}s")
    return _whisper_model

def run_local_whisper(
    audio: "np.ndarray",
    sr: int = WHISPER_SR,
) -> "tuple[list, float, float]":
    """Run local GPU faster-whisper on the given audio."""
    logger.info("Starting local Whisper STT (CUDA)…")
    t0 = time.perf_counter()
    model = get_whisper_model()
    
    segments, info = model.transcribe(
        audio,
        beam_size=7,
        language="kn",
        task="transcribe",
        condition_on_previous_text=False,
        no_speech_threshold=0.85,  # Make it less likely to skip noisy speech
        log_prob_threshold=None,   # Don't drop segments due to low confidence
        vad_filter=True,           # Strips silence to prevent hallucinations
        vad_parameters=dict(min_silence_duration_ms=500),
        initial_prompt="ನಮಸ್ಕಾರ, ಇದು ಕನ್ನಡ ಭಾಷೆಯ ಆಡಿಯೋ. ದಯವಿಟ್ಟು ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ." # Forces Kannada
    )
    
    seg_list = []
    confs    = []
    for s in segments:
        text = s.text.strip()
        if not text:
            continue
        seg_list.append({
            "start": round(s.start, 2),
            "end":   round(s.end, 2),
            "text":  text,
            "confidence": round(s.no_speech_prob, 4), # Note: inverse of confidence, but returning raw
        })
        confs.append(s.no_speech_prob)
        
    avg_conf = 1.0 - (np.mean(confs) if confs else 0.0)
    elapsed = time.perf_counter() - t0
    logger.info(f"Local Whisper: {len(seg_list)} segments [{elapsed:.2f}s]")
    return seg_list, float(avg_conf), elapsed



# ── Noise Reduction ────────────────────────────────────────────────────────────

def _estimate_snr_db(y: np.ndarray) -> float:
    """Rough SNR estimate using RMS energy variance across frames."""
    if len(y) < 1600:
        return 99.0
    frame_size  = 1600
    frames      = [y[i:i + frame_size] for i in range(0, len(y) - frame_size, frame_size)]
    rms_values  = np.array([np.sqrt(np.mean(f ** 2)) for f in frames if len(f) == frame_size])
    if len(rms_values) < 2 or rms_values.mean() == 0:
        return 99.0
    snr = 20 * np.log10(rms_values.mean() / (rms_values.std() + 1e-9))
    return float(np.clip(snr, 0, 60))


def denoise_audio(y: np.ndarray, sr: int) -> "tuple[np.ndarray, float]":
    """
    Apply lightweight spectral noise reduction.

    Returns (denoised_y, elapsed_seconds).
    Auto-skips if estimated SNR is already above DENOISE_SNR_SKIP_DB.
    Processing target: < 2 seconds.
    """
    t0 = time.perf_counter()

    if not ENABLE_DENOISING:
        return y, 0.0

    snr = _estimate_snr_db(y)
    if snr >= DENOISE_SNR_SKIP_DB:
        elapsed = time.perf_counter() - t0
        logger.info(
            f"Denoising skipped — SNR ≈ {snr:.1f} dB  "
            f"(threshold {DENOISE_SNR_SKIP_DB} dB)  [{elapsed:.3f}s]"
        )
        return y, elapsed

    try:
        import noisereduce as nr
        y_denoised = nr.reduce_noise(y=y, sr=sr, prop_decrease=0.8, stationary=False)
        elapsed    = time.perf_counter() - t0
        logger.info(f"Denoising applied (SNR ≈ {snr:.1f} dB)  [{elapsed:.2f}s]")
        return y_denoised.astype(np.float32), elapsed
    except ImportError:
        logger.warning(
            "noisereduce not installed — skipping denoising. "
            "Run:  pip install noisereduce"
        )
        return y, time.perf_counter() - t0
    except Exception as exc:
        logger.warning(f"Denoising failed ({exc}) — using raw audio.")
        return y, time.perf_counter() - t0


# ── STT ────────────────────────────────────────────────────────────────────────

HINDI_STOPWORDS = [
    "hai", "hain", "kya", "nahi", "nahin", "haan", "aur", "ki", "ka", "ke",
    "ko", "se", "mein", "tha", "thi", "the", "bhi", "toh", "yeh", "woh",
    "kuch", "sab", "bahut", "accha", "theek", "matlab", "isliye", "lekin",
    "kyunki", "phir", "abhi", "pehle", "baad", "main", "mujhe", "tumhe",
    "unhe", "usse", "inhe", "apna", "apni", "apne", "ek", "do", "teen",
    "char", "paanch", "chhe", "saat", "aath", "nau", "das", "kaisa",
    "kaisi", "kaise", "kyun", "kab", "kahan", "kaun", "kitna", "kitni",
]


def transcribe_with_sarvam(
    audio: "str | np.ndarray",
    sr: int = WHISPER_SR,
) -> "tuple[list, float, float]":
    """Transcribe audio using Sarvam AI API (auto-chunks to max 25s)."""
    import io
    import requests
    import soundfile as sf
    import numpy as np
    
    logger.info("Starting Sarvam STT (chunked)…")
    t0 = time.perf_counter()

    api_key = os.getenv("SARVAM_API_KEY", "sk_xm51r8rz_Hk1FSqzA3Ag8WaQTvbam1U7O")
    if not api_key:
        logger.warning("SARVAM_API_KEY not set. Cannot use Sarvam API.")
        return [], -1.0, time.perf_counter() - t0

    try:
        url = "https://api.sarvam.ai/speech-to-text"
        headers = {"api-subscription-key": api_key}
        
        # Load audio into numpy array if it's a file path
        if isinstance(audio, str):
            import librosa
            y, _ = librosa.load(audio, sr=sr, mono=True)
        else:
            y = audio

        chunk_dur = 25.0
        chunk_samples = int(chunk_dur * sr)
        total_samples = len(y)
        
        all_res = []
        
        for i in range(0, total_samples, chunk_samples):
            chunk = y[i:i + chunk_samples]
            chunk_start_sec = i / sr
            
            buf = io.BytesIO()
            sf.write(buf, chunk, sr, format='WAV', subtype='PCM_16')
            buf.seek(0)
            wav_bytes = buf.read()
            
            files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
            data = {
                "model": "saaras:v3",
                "language_code": "kn-IN",
                "with_timestamps": "true"
            }
            
            resp = requests.post(url, headers=headers, files=files, data=data, timeout=60)
            if resp.status_code != 200:
                logger.error(f"Sarvam API failed on chunk with {resp.status_code}: {resp.text}")
                resp.raise_for_status()
            
            j = resp.json()
            timestamps = j.get("timestamps", {})
            words = timestamps.get("words", [])
            starts = timestamps.get("start_time_seconds", [])
            ends = timestamps.get("end_time_seconds", [])
            
            if words and len(words) == len(starts) == len(ends):
                for w_idx in range(len(words)):
                    all_res.append({
                        "start": round(chunk_start_sec + starts[w_idx], 2),
                        "end": round(chunk_start_sec + ends[w_idx], 2),
                        "text": words[w_idx],
                        "confidence": 0.99
                    })
            else:
                transcript = j.get("transcript", "")
                if transcript:
                    all_res.append({
                        "start": chunk_start_sec,
                        "end": chunk_start_sec + (len(chunk) / sr),
                        "text": transcript,
                        "confidence": 0.99
                    })
                    
        elapsed = time.perf_counter() - t0
        logger.info(f"Sarvam: {len(all_res)} word segments across chunks [{elapsed:.2f}s]")
        return all_res, 0.99, elapsed

    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code
        logger.error(f"Sarvam API failed with status {status}: {exc.response.text}")
        if status in [402, 403, 429]:
            raise Exception("Sarvam API out of credits or rate limited! Please check your Sarvam billing dashboard.")
        raise Exception(f"Sarvam API error: {status} - {exc.response.text}")
    except requests.exceptions.ConnectionError:
        logger.error("Sarvam API failed: Connection Error (Offline/No Internet).")
        raise Exception("Network Error: Could not connect to Sarvam AI. Are you offline?")
    except requests.exceptions.Timeout:
        logger.error("Sarvam API failed: Timeout.")
        raise Exception("Network Timeout: Sarvam AI took too long to respond.")
    except Exception as exc:
        logger.error(f"Sarvam API failed unexpectedly: {exc}")
        raise Exception(f"Failed to communicate with Sarvam API: {exc}")

# ── Speaker assignment ─────────────────────────────────────────────────────────

def assign_speakers(segments: list, diarization_segments: list) -> list:
    res = []
    for seg in segments:
        best_speaker = "SPEAKER_01"
        max_overlap  = -1.0
        for d in diarization_segments:
            overlap = max(
                0.0,
                min(seg["end"], d["end"]) - max(seg["start"], d["start"]),
            )
            if overlap > max_overlap:
                max_overlap  = overlap
                best_speaker = d["speaker"]
        res.append({**seg, "speaker": best_speaker})
    return res


def reconstruct_sentences(segments: list, max_pause: float = 2.0, max_duration: float = 15.0) -> list:
    if not segments:
        return []
    recon = []
    cur   = segments[0].copy()
    for nxt in segments[1:]:
        same_speaker = cur.get("speaker") == nxt.get("speaker")
        short_pause  = (nxt["start"] - cur["end"]) <= max_pause
        under_duration = (nxt["end"] - cur["start"]) <= max_duration
        
        if same_speaker and short_pause and under_duration:
            cur["end"]        = nxt["end"]
            cur["text"]       = cur["text"] + " " + nxt["text"]
            cur["confidence"] = min(
                cur.get("confidence", -1.0),
                nxt.get("confidence", -1.0),
            )
        else:
            recon.append(cur)
            cur = nxt.copy()
    recon.append(cur)
    return recon





# ── Diff helper ────────────────────────────────────────────────────────────────

def diff_transcripts(raw: list, corrected: list) -> list:
    corrections = []
    for r, c in zip(raw, corrected):
        if r["text"].strip() != c["text"].strip():
            corrections.append({
                "time":      f"{r['start']}s - {r['end']}s",
                "speaker":   r.get("speaker", "Unknown"),
                "raw":       r["text"].strip(),
                "corrected": c["text"].strip(),
            })
    return corrections


# ── Profiling helper ───────────────────────────────────────────────────────────

def _print_timing_table(timings: dict, total: float) -> None:
    """Print a formatted stage-timing table to the log."""
    STAGE_LABELS = {
        "audio_load":            "Audio Loading",
        "noise_reduction":       "Noise Reduction",
        "diarization":           "Speaker Diarization",
        "feature_extraction":    "Feature Extraction",
        "whisper_transcription": "Whisper Transcription",
        "dict_correction":       "Dictionary Correction",
        "classification":        "Classification",
        "report_generation":     "Report Generation",
    }
    W_STAGE, W_TIME = 28, 10
    sep = "+" + "-" * (W_STAGE + 2) + "+" + "-" * (W_TIME + 2) + "+"
    mid = "+" + "-" * (W_STAGE + 2) + "+" + "-" * (W_TIME + 2) + "+"
    bot = "+" + "-" * (W_STAGE + 2) + "+" + "-" * (W_TIME + 2) + "+"

    lines = [sep]
    lines.append(
        f"| {'Stage':<{W_STAGE}} | {'Time (s)':>{W_TIME}} |"
    )
    lines.append(mid)
    for key, val in timings.items():
        label = STAGE_LABELS.get(key, key)
        lines.append(f"| {label:<{W_STAGE}} | {val:>{W_TIME}.3f} |")
    lines.append(mid)
    lines.append(f"| {'Total Processing Time':<{W_STAGE}} | {total:>{W_TIME}.3f} |")
    lines.append(bot)

    print("\n" + "\n".join(lines) + "\n")


# ── Main pipeline entry ────────────────────────────────────────────────────────

def perform_transcription(
    audio_path: str,
    diarization_segments: list,
    audio_array: "np.ndarray | None" = None,
    audio_sr: int = WHISPER_SR,
    diarization_time: float = 0.0,
    feature_time: float = 0.0,
) -> dict:
    """
    Full transcription pipeline.

    Args:
        audio_path:           Path to the WAV file (used if audio_array is None).
        diarization_segments: Speaker segments from pyannote.
        audio_array:          Optional pre-loaded float32 numpy array — avoids
                              re-loading from disk. Expected to be already denoised.
        audio_sr:             Sample rate of audio_array.
        diarization_time:     Wall-clock seconds spent in diarization (for table).
        feature_time:         Wall-clock seconds spent in feature extraction (for table).
    """
    t_pipeline_start = time.perf_counter()
    timings: dict[str, float] = {}

    # ── 1. Audio load (if not pre-loaded) ─────────────────────────────────────
    if audio_array is not None:
        y_input   = audio_array
        t_load    = 0.0   # already counted in caller
    else:
        import librosa
        t_load0 = time.perf_counter()
        y_input, audio_sr = librosa.load(audio_path, sr=WHISPER_SR, mono=True)
        t_load  = time.perf_counter() - t_load0
        logger.info(f"Audio loaded (fallback inside transcription)  [{t_load:.2f}s]")

    timings["audio_load"] = round(t_load, 3)

    # ── 2. STT (Primary: Sarvam, Fallback: Local Whisper) ─────────────────────
    engine_used = "Sarvam Saaras v3"
    fallback_reason = None
    try:
        raw_sarvam, avg_confidence, t_stt = transcribe_with_sarvam(y_input, audio_sr)
    except Exception as exc:
        fallback_reason = str(exc)
        logger.warning(f"Sarvam API failed ({fallback_reason}). Falling back to local Whisper.")
        engine_used = "Faster-Whisper Medium (CUDA)"
        raw_sarvam, avg_confidence, t_stt = run_local_whisper(y_input, audio_sr)
    
    # ── 3. Speaker assignment + sentence reconstruction ────────────────────────
    assigned_segments = assign_speakers(raw_sarvam, diarization_segments)
    sentences         = reconstruct_sentences(assigned_segments)
    
    # ── 4. Dictionary Correction ──────────────────────────────────────────────
    from services.kannada_dictionary import apply_dictionary_correction, load_custom_dictionary
    t_corr0 = time.perf_counter()
    corrected = apply_dictionary_correction(sentences)
    t_corr = time.perf_counter() - t_corr0
    timings["dictionary_correction"] = round(t_corr, 3)

    total = time.perf_counter() - t_pipeline_start
    
    timings["whisper_transcription"] = round(t_stt, 3) # keep key for compatibility

    # ── 5. Diff for UI ─────────────────────────────────────────────────────────
    applied_corrections = diff_transcripts(sentences, corrected)
    logger.info(f"Transcription pipeline — {len(applied_corrections)} correction(s) applied.")

    # ── 6. Profiling table ─────────────────────────────────────────────────────
    # Inject parallel-stage timings (measured outside this function)
    full_timings = {
        "audio_load":            timings.get("audio_load", 0.0),
        "noise_reduction":       0.0, # Managed externally
        "diarization":           round(diarization_time, 3),
        "feature_extraction":    round(feature_time, 3),
        "whisper_transcription": timings.get("whisper_transcription", 0.0),
        "dict_correction":       timings.get("dictionary_correction", 0.0),
    }

    total = time.perf_counter() - t_pipeline_start
    _print_timing_table(full_timings, total)

    return {
        "raw":                  sentences,
        "corrected":            corrected,
        "corrections_applied":  applied_corrections,
        "avg_confidence":       round(avg_confidence, 4),
        "pipeline": {
            "stt_engine":          engine_used,
            "fallback_reason":     fallback_reason,
            "stt_device":          "cloud" if "Sarvam" in engine_used else DEVICE,
            "stt_precision":       "fp32" if "Sarvam" in engine_used else COMPUTE_TYPE,
            "correction_provider": "dictionary",
            "corrections_count":   len(applied_corrections),
            "dictionary_entries":  len(load_custom_dictionary()),
        },
        "timings": full_timings,
    }
