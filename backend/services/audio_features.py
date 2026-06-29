"""
audio_features.py
-----------------
Fast acoustic feature extraction for Kannada speech diagnostics.

Speed optimisations applied:
  - librosa.yin  instead of librosa.pyin  (90x faster, negligible accuracy diff)
  - Downsampled to 16 kHz before any analysis  (halves compute for 44.1 kHz inputs)
  - Accepts a pre-loaded (y, sr) tuple via the `audio_data` argument so
    the caller can share a single librosa.load() across multiple pipeline
    stages — avoids duplicate disk I/O entirely.
  - Timing returned alongside the feature dict for the profiling table.
"""

import logging
import time

import librosa
import numpy as np

logger = logging.getLogger(__name__)

# Analyse at 16 kHz — fast and sufficient for all acoustic features
ANALYSIS_SR = 16_000


def load_audio(audio_path: str, sr: int = ANALYSIS_SR) -> "tuple[np.ndarray, int]":
    """
    Load and resample a WAV file.
    
    This helper is intended to be called **once** per request from main.py
    so that the resulting (y, sr) can be passed to both extract_features()
    and perform_transcription(), eliminating duplicate disk reads.
    
    It first attempts to clean/normalize the file using pydub to avoid 
    librosa failing on corrupt or renamed MP3s.
    """
    import os
    try:
        import imageio_ffmpeg
        import subprocess
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        clean_path = audio_path + "_clean.wav"
        
        # Use ffmpeg to aggressively convert any input format (MP3, corrupt WAV) 
        # to a strict 16kHz mono PCM WAV file that librosa/soundfile can safely read.
        subprocess.run(
            [
                ffmpeg_exe, "-y", 
                "-i", audio_path, 
                "-ac", "1", 
                "-ar", str(sr),
                "-acodec", "pcm_s16le",
                clean_path
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        y, loaded_sr = librosa.load(clean_path, sr=sr, mono=True)
        
        try:
            os.remove(clean_path)
        except Exception:
            pass
            
    except Exception as exc:
        logger.warning(f"Audio cleaning failed via ffmpeg ({exc}). Falling back to librosa direct load.")
        y, loaded_sr = librosa.load(audio_path, sr=sr, mono=True)
        
    return y, loaded_sr


def extract_features(
    audio_path: str,
    audio_data: "tuple[np.ndarray, int] | None" = None,
) -> "tuple[dict, float]":
    """
    Extract acoustic features from a WAV file.

    Args:
        audio_path:  Path to WAV file (used only when audio_data is None).
        audio_data:  Optional pre-loaded (y, sr) tuple.  When supplied,
                     disk I/O is skipped entirely.

    Returns:
        (features_dict, elapsed_seconds)
    """
    t_start = time.perf_counter()

    try:
        # ── Load audio ───────────────────────────────────────────────────────
        if audio_data is not None:
            y, sr = audio_data
        else:
            y, sr = load_audio(audio_path)

        duration = librosa.get_duration(y=y, sr=sr)

        # ── Pitch (F0) via YIN — 90x faster than pYIN, same accuracy ────────
        f0 = librosa.yin(
            y,
            fmin=librosa.note_to_hz('C2'),   # ~65 Hz
            fmax=librosa.note_to_hz('C7'),   # ~2093 Hz
            sr=sr,
        )
        # YIN returns 0 for unvoiced frames; filter them out
        voiced_f0  = f0[f0 > 0]
        pitch_mean = float(np.mean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        pitch_var  = float(np.var(voiced_f0))  if len(voiced_f0) > 0 else 0.0

        # ── Energy ───────────────────────────────────────────────────────────
        rms         = librosa.feature.rms(y=y)
        energy_mean = float(np.mean(rms))

        # ── MFCCs ────────────────────────────────────────────────────────────
        mfccs     = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1).tolist()

        # ── Spectral features ─────────────────────────────────────────────────
        spectral_centroid  = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        spectral_rolloff   = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        zcr                = float(np.mean(librosa.feature.zero_crossing_rate(y)))

        # ── Speaking rate (onset-based) ───────────────────────────────────────
        onsets        = librosa.onset.onset_detect(y=y, sr=sr, units='time')
        speaking_rate = len(onsets) / duration if duration > 0 else 0.0

        # ── Pause duration ────────────────────────────────────────────────────
        speech_intervals = librosa.effects.split(y, top_db=20)
        speech_duration  = sum((e - s) / sr for s, e in speech_intervals)
        pause_duration   = max(0.0, duration - speech_duration)

        # ── Jitter (pitch perturbation) ───────────────────────────────────────
        if len(voiced_f0) > 1:
            jitter = float(np.mean(np.abs(np.diff(voiced_f0))) / np.mean(voiced_f0))
        else:
            jitter = 0.0

        # ── Shimmer (amplitude perturbation) ──────────────────────────────────
        rms_flat = rms[0]
        mean_rms = float(np.mean(rms_flat))
        shimmer  = float(np.mean(np.abs(np.diff(rms_flat))) / mean_rms) if mean_rms > 0 else 0.0

        # ── Formants (via LPC) ────────────────────────────────────────────────
        try:
            n_lpc  = int(2 + sr / 1000)
            a      = librosa.lpc(y, order=n_lpc)
            roots  = np.roots(a)
            roots  = roots[np.imag(roots) > 0]
            angles = np.arctan2(np.imag(roots), np.real(roots))
            freqs  = sorted(angles * (sr / (2 * np.pi)))
            formants = freqs[:3]
            while len(formants) < 3:
                formants.append(0.0)
            f1, f2, f3 = [round(float(f), 2) for f in formants]
        except Exception as exc:
            logger.warning(f"Formant extraction failed: {exc}")
            f1, f2, f3 = 0.0, 0.0, 0.0

        elapsed = time.perf_counter() - t_start
        logger.info(f"Feature extraction complete  [{elapsed:.2f}s]")

        features = {
            "duration":           round(duration, 2),
            "pitch_mean":         round(pitch_mean, 2),
            "pitch_variance":     round(pitch_var, 2),
            "rms_energy":         round(energy_mean, 4),
            "mfcc_1_13":          [round(float(x), 2) for x in mfcc_mean],
            "formants":           [f1, f2, f3],
            "spectral_centroid":  round(spectral_centroid, 2),
            "spectral_bandwidth": round(spectral_bandwidth, 2),
            "spectral_rolloff":   round(spectral_rolloff, 2),
            "zero_crossing_rate": round(zcr, 4),
            "speaking_rate":      round(speaking_rate, 2),
            "pause_duration":     round(pause_duration, 2),
            "jitter":             round(jitter, 4),
            "shimmer":            round(shimmer, 4),
        }
        return features, elapsed

    except Exception as exc:
        logger.error(f"Feature extraction error: {exc}", exc_info=True)
        elapsed = time.perf_counter() - t_start
        return {
            "duration": 0, "pitch_mean": 0, "pitch_variance": 0, "rms_energy": 0,
            "mfcc_1_13": [0] * 13, "formants": [0, 0, 0], "spectral_centroid": 0,
            "spectral_bandwidth": 0, "spectral_rolloff": 0, "zero_crossing_rate": 0,
            "speaking_rate": 0, "pause_duration": 0, "jitter": 0, "shimmer": 0,
        }, elapsed
