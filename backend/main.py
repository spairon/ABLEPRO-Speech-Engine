"""
main.py
-------
ABLEPRO Speech Diagnostic Engine — FastAPI application.

GPU / Performance optimisations (RTX 4050 — 6 GB VRAM):
  - Lifespan context: GPU banner + model pre-warming at startup.
  - Single audio load per request; shared array passed to diarization,
    feature extraction, and transcription (zero duplicate disk I/O).
  - Diarization + Feature Extraction run in parallel (asyncio.gather).
  - All per-stage timings collected and printed as a table in the server log.
  - SSE events carry elapsed_ms for real-time frontend visibility.
"""

import asyncio
from dotenv import load_dotenv
load_dotenv()

import json
import logging
import os
import shutil
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Services
from services.audio_features import extract_features, load_audio, ANALYSIS_SR
from services.classifier import predict_diagnostics
from services.diarization import get_pipeline, perform_diarization
from services.gpu_utils import GPU_INFO, IS_CUDA, print_gpu_banner
from services.kannada_dictionary import load_custom_dictionary
from services.transcription import (
    WHISPER_SR,
    perform_transcription,
    denoise_audio,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Shared thread-pool for blocking IO/compute
_executor = ThreadPoolExecutor(max_workers=4)


def _run_blocking(func, *args):
    """Schedule a blocking function in the shared thread-pool."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(_executor, func, *args)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Executed once on startup (before the first request) and once on shutdown.
    Pre-warms all heavy models so the first real request is fast.
    """
    # ── GPU Banner ──────────────────────────────────────────────────────────
    print_gpu_banner()

    # ── Pre-warm Whisper ────────────────────────────────────────────────────
    logger.info("Pre-warming Faster-Whisper Medium pipeline…")
    try:
        from services.transcription import get_whisper_model
        await _run_blocking(get_whisper_model)
        logger.info("✅ Faster-Whisper ready.")
    except Exception as exc:
        logger.warning(f"Faster-Whisper pre-warm failed: {exc}")

    # ── Pre-warm Pyannote Diarization ───────────────────────────────────────
    logger.info("Pre-warming Pyannote diarization pipeline…")
    try:
        await _run_blocking(get_pipeline)
        logger.info("✅ Diarization pipeline ready.")
    except Exception as exc:
        logger.warning(f"Diarization pre-warm skipped (HF_TOKEN missing or error): {exc}")

    # ── Pre-load Kannada Dictionary ─────────────────────────────────────────
    logger.info("Loading Kannada correction dictionary…")
    try:
        d = load_custom_dictionary()
        logger.info(f"✅ Dictionary loaded — {len(d)} entries.")
    except Exception as exc:
        logger.warning(f"Dictionary pre-load failed: {exc}")

    logger.info("🚀 ABLEPRO pipeline ready — waiting for requests.")
    yield
    # Shutdown (nothing special needed; OS cleans up GPU memory)
    logger.info("ABLEPRO shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="ABLEPRO Speech Diagnostic Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Quota Manager
# ---------------------------------------------------------------------------
QUOTA_FILE = Path("quota.json")
QUOTA_LIMIT = 3600  # 60 minutes default

def get_quota() -> dict:
    if QUOTA_FILE.exists():
        try:
            with open(QUOTA_FILE, "r") as f:
                data = json.load(f)
                return {"used_seconds": data.get("used_seconds", 0), "limit_seconds": QUOTA_LIMIT}
        except Exception:
            return {"used_seconds": 0, "limit_seconds": QUOTA_LIMIT}
    return {"used_seconds": 0, "limit_seconds": QUOTA_LIMIT}

def add_quota(seconds: float):
    current = get_quota()
    used = current["used_seconds"] + seconds
    with open(QUOTA_FILE, "w") as f:
        json.dump({"used_seconds": used}, f)

@app.get("/api/quota")
def read_quota():
    return get_quota()


# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------

def _sse(event: str, data: dict) -> str:
    """Format a single Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# Internal helpers — wrappers that capture timing
# ---------------------------------------------------------------------------

def _diarize_timed(audio_path: str, audio_input: "dict | None"):
    """Wrapper: returns (segments, speaker_count, speaker_stats, elapsed_seconds)."""
    t0 = time.perf_counter()
    segments, speaker_count, speaker_stats = perform_diarization(audio_path, audio_input=audio_input)
    return segments, speaker_count, speaker_stats, time.perf_counter() - t0


def _features_timed(audio_path: str, audio_data: "tuple | None"):
    """Wrapper: returns (features_dict, elapsed_seconds)."""
    features, elapsed = extract_features(audio_path, audio_data=audio_data)
    return features, elapsed


def _classify_timed(features: dict):
    """Wrapper: returns (classification_dict, elapsed_seconds)."""
    t0     = time.perf_counter()
    result = predict_diagnostics(features)
    return result, time.perf_counter() - t0


# ---------------------------------------------------------------------------
# Streaming endpoint  (SSE — real-time progress)
# ---------------------------------------------------------------------------

@app.post("/api/analyze-stream")
async def analyze_audio_stream(file: UploadFile = File(...)):
    """
    Full pipeline with Server-Sent Events so the browser shows live progress.

    Stages (wall-clock order):
      0. Audio Load & Denoise — single librosa.load() shared across all stages, followed by fast noise reduction
      1a. Diarization        ─┐ parallel (using denoised audio)
      1b. Feature Extraction ─┘
      2. Whisper STT         — noise-reduced audio
      3. Classification      — acoustic features → diagnostics
    """
    if not file.filename.lower().endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only .wav files are supported.")

    file_id   = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"

    # Save file synchronously before streaming begins
    with open(file_path, "wb") as buf:
        shutil.copyfileobj(file.file, buf)
    logger.info(f"Saved upload → {file_path}")

    async def event_generator() -> AsyncGenerator[str, None]:
        t_request_start = time.perf_counter()
        wall_timings: dict[str, float] = {}

        try:
            # ── Stage 0: Single audio load + Denoise ───────────────────────────────────
            yield _sse("stage", {
                "stage": "loading", "status": "running",
                "message": "Loading & cleaning audio…",
            })
            t0 = time.perf_counter()
            raw_audio_np, raw_audio_sr = await _run_blocking(load_audio, str(file_path), ANALYSIS_SR)
            t_load = time.perf_counter() - t0
            
            # --- Quota Check ---
            audio_dur = len(raw_audio_np) / raw_audio_sr
            current_quota = get_quota()
            if current_quota["used_seconds"] + audio_dur > current_quota["limit_seconds"]:
                yield _sse("error", {"detail": f"Quota Exceeded! You have used your transcription limit. Upgrade to continue."})
                return
            # Note: We will only deduct quota AFTER transcription succeeds and only if Sarvam was used!
            
            wall_timings["audio_load"] = round(t_load, 3)
            logger.info(f"Audio loaded ({audio_dur:.1f}s)  [{t_load:.2f}s]")

            # Denoise BEFORE anything else
            t0_denoise = time.perf_counter()
            audio_np, t_denoise_internal = await _run_blocking(denoise_audio, raw_audio_np, raw_audio_sr)
            t_denoise_wall = time.perf_counter() - t0_denoise
            wall_timings["noise_reduction"] = round(t_denoise_wall, 3)
            audio_sr = raw_audio_sr

            # Build a torch-compatible dict for pyannote (avoids its own disk I/O)
            pyannote_input = None
            try:
                import torch
                # pyannote expects float32 tensor [channels, samples]
                waveform      = torch.from_numpy(audio_np).unsqueeze(0)
                pyannote_input = {"waveform": waveform, "sample_rate": audio_sr}
            except Exception:
                pass   # fall back to file path if torch unavailable

            yield _sse("stage", {
                "stage": "loading", "status": "done",
                "elapsed_ms": round((t_load + t_denoise_wall) * 1000),
            })

            # ── Stage 1a + 1b: Diarization & Feature Extraction ─────────────
            yield _sse("stage", {
                "stage": "diarization", "status": "running",
                "message": "Identifying speakers…",
            })
            yield _sse("stage", {
                "stage": "features", "status": "running",
                "message": "Extracting acoustic features…",
            })

            diarization_task = _run_blocking(
                _diarize_timed, str(file_path), pyannote_input
            )
            features_task = _run_blocking(
                _features_timed, str(file_path), (audio_np, audio_sr)
            )

            (diarization_segments, speaker_count, speaker_stats, t_diar), \
            (features, t_feat) = await asyncio.gather(
                diarization_task, features_task
            )

            wall_timings["diarization"]       = round(t_diar, 3)
            wall_timings["feature_extraction"] = round(t_feat, 3)

            yield _sse("stage", {
                "stage": "diarization", "status": "done",
                "speakerCount": speaker_count,
                "elapsed_ms": round(t_diar * 1000),
            })
            yield _sse("stage", {
                "stage": "features", "status": "done",
                "elapsed_ms": round(t_feat * 1000),
            })

            # ── Stage 2: Transcription ───────────────────────────────────────
            yield _sse("stage", {
                "stage": "transcription", "status": "running",
                "message": "Transcribing Kannada audio…",
            })

            # Resampled array for Whisper (16 kHz == ANALYSIS_SR here already)
            # If ANALYSIS_SR != WHISPER_SR, resample — but both are 16 kHz.
            whisper_audio = audio_np if audio_sr == WHISPER_SR else None

            transcription_dict = await _run_blocking(
                perform_transcription,
                str(file_path),
                diarization_segments,
                whisper_audio,          # pre-loaded array (avoids re-loading)
                audio_sr,
                t_diar,                 # pass parallel timings for profiling table
                t_feat,
            )

            t_stt = transcription_dict.get("timings", {}).get("whisper_transcription", 0.0)
            yield _sse("stage", {
                "stage": "transcription", "status": "done",
                "segments": len(transcription_dict.get("corrected", [])),
                "elapsed_ms": round(t_stt * 1000),
            })
            
            # --- Quota Deduction (Only if Sarvam succeeded) ---
            stt_engine = transcription_dict.get("pipeline", {}).get("stt_engine", "")
            if "Sarvam" in stt_engine:
                add_quota(audio_dur)

            # ── Stage 3: Classification ──────────────────────────────────────
            yield _sse("stage", {
                "stage": "classification", "status": "running",
                "message": "Running ML classifiers…",
            })

            classification_results, t_class = await _run_blocking(
                _classify_timed, features
            )
            wall_timings["classification"] = round(t_class, 3)

            yield _sse("stage", {
                "stage": "classification", "status": "done",
                "elapsed_ms": round(t_class * 1000),
            })

            # ── Final result ─────────────────────────────────────────────────
            t_total = time.perf_counter() - t_request_start
            wall_timings["total"] = round(t_total, 3)

            logger.info(
                f"✅ Request complete — total wall time: {t_total:.2f}s  "
                f"(audio={t_load:.2f}s, denoise={t_denoise_wall:.2f}s, diar={t_diar:.2f}s, "
                f"feat={t_feat:.2f}s, stt={t_stt:.2f}s, cls={t_class:.2f}s)"
            )

            response_data = {
                "status": "success",
                "overview": {
                    "speakerCount":     speaker_count,
                    "speakerStats":     speaker_stats,
                    "audioDuration":    features.get("duration", 0),
                    "predictedGender":  classification_results.get("gender"),
                    "predictedAgeGroup": classification_results.get("age"),
                    "speechPattern":    classification_results.get("speech_pattern"),
                    "speechHealthScore": classification_results.get("health_score", 85),
                },
                "rawTranscription":       transcription_dict.get("raw", []),
                "correctedTranscription": transcription_dict.get("corrected", []),
                "pipelineInfo":           transcription_dict.get("pipeline", {}),
                "acousticFeatures":       features,
                "classification":         classification_results,
                "performanceTimings":     wall_timings,
            }
            yield _sse("result", response_data)

        except Exception as exc:
            logger.error(f"Pipeline error: {exc}", exc_info=True)
            yield _sse("error", {"message": str(exc)})
        finally:
            if file_path.exists():
                try:
                    os.remove(file_path)
                except Exception as ex:
                    logger.warning(f"Could not remove temp file: {ex}")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Comparison Endpoint
# ---------------------------------------------------------------------------

@app.post("/api/compare")
async def compare_audio(
    conv_file: UploadFile = File(...),
    word_file: UploadFile = File(...),
):
    """Compare Conversation (C) and Word Repetition (W) audio files."""
    if (
        not conv_file.filename.lower().endswith('.wav')
        or not word_file.filename.lower().endswith('.wav')
    ):
        raise HTTPException(status_code=400, detail="Only .wav files are supported.")

    c_id   = str(uuid.uuid4())
    w_id   = str(uuid.uuid4())
    c_path = UPLOAD_DIR / f"{c_id}_{conv_file.filename}"
    w_path = UPLOAD_DIR / f"{w_id}_{word_file.filename}"

    try:
        with open(c_path, "wb") as buf:
            shutil.copyfileobj(conv_file.file, buf)
        with open(w_path, "wb") as buf:
            shutil.copyfileobj(word_file.file, buf)

        # Load audio for both files (single load each)
        (c_audio, c_sr), (w_audio, w_sr) = await asyncio.gather(
            _run_blocking(load_audio, str(c_path)),
            _run_blocking(load_audio, str(w_path)),
        )

        # Extract features using pre-loaded arrays
        (c_feat, _), (w_feat, _) = await asyncio.gather(
            _run_blocking(extract_features, str(c_path), (c_audio, c_sr)),
            _run_blocking(extract_features, str(w_path), (w_audio, w_sr)),
        )

        # Classify
        (c_class, _), (w_class, _) = await asyncio.gather(
            _run_blocking(_classify_timed, c_feat),
            _run_blocking(_classify_timed, w_feat),
        )

        from services.comparison import generate_comparison_scores
        comparison = generate_comparison_scores(c_feat, w_feat, c_class, w_class)

        return {
            "status": "success",
            "comparison": comparison,
            "conversation_features": c_feat,
            "word_features": w_feat,
        }

    except Exception as exc:
        logger.error(f"Comparison error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        for p in [c_path, w_path]:
            if p.exists():
                try:
                    os.remove(p)
                except Exception:
                    pass


# ---------------------------------------------------------------------------
# System Status Endpoint
# ---------------------------------------------------------------------------

@app.get("/api/system/status")
async def get_system_status():
    from services.transcription import WHISPER_MODEL_SIZE

    return {
        "gpu": {
            "name":         GPU_INFO.get("gpu_name", "N/A"),
            "cuda_enabled": GPU_INFO.get("cuda_enabled", False),
            "vram_gb":      GPU_INFO.get("vram_gb", 0),
            "device":       GPU_INFO.get("device", "cpu"),
            "compute_type": GPU_INFO.get("compute_type", "int8"),
        },
        "whisper": {
            "model":  WHISPER_MODEL_SIZE,
            "device": GPU_INFO.get("device", "cpu"),
            "precision": GPU_INFO.get("compute_type", "int8"),
            "local":  True,
        },
        "correction": {
            "provider": "dictionary",
            "llm_disabled": True,
        },
        "pipeline": {
            "transcription":   "sarvam-ai / faster-whisper",
            "correction":      "dictionary",
            "speaker_analysis": "pyannote",
        },
    }


# ---------------------------------------------------------------------------
# Dictionary Endpoint
# ---------------------------------------------------------------------------

@app.get("/api/dictionary")
async def get_dictionary():
    from services.kannada_dictionary import _DICT_PATH
    if not _DICT_PATH.exists():
        return {}
    with open(_DICT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/dictionary")
async def update_dictionary(new_dict: dict):
    from services.kannada_dictionary import _DICT_PATH, reload_dictionary
    with open(_DICT_PATH, "w", encoding="utf-8") as f:
        json.dump(new_dict, f, ensure_ascii=False, indent=2)
    reload_dictionary()
    return {"status": "success", "entries": len(new_dict)}


# ---------------------------------------------------------------------------
# Classic JSON endpoint (kept for backward compatibility / testing)
# ---------------------------------------------------------------------------

@app.post("/api/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.wav'):
        raise HTTPException(status_code=400, detail="Only .wav files are supported.")

    file_id   = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Single audio load + Denoise
        raw_audio_np, raw_audio_sr = await _run_blocking(load_audio, str(file_path))
        audio_np, _ = await _run_blocking(denoise_audio, raw_audio_np, raw_audio_sr)
        audio_sr = raw_audio_sr

        # Build pyannote input
        pyannote_input = None
        try:
            import torch
            waveform       = torch.from_numpy(audio_np).unsqueeze(0)
            pyannote_input = {"waveform": waveform, "sample_rate": audio_sr}
        except Exception:
            pass

        logger.info("Starting parallel diarization + feature extraction…")
        (diarization_segments, speaker_count, t_diar), (features, t_feat) = \
            await asyncio.gather(
                _run_blocking(_diarize_timed, str(file_path), pyannote_input),
                _run_blocking(_features_timed, str(file_path), (audio_np, audio_sr)),
            )

        logger.info("Diarization & features done — starting transcription…")
        transcription_dict = await _run_blocking(
            perform_transcription,
            str(file_path),
            diarization_segments,
            audio_np,
            audio_sr,
            t_diar,
            t_feat,
        )

        logger.info("Transcription done — classifying…")
        classification_results, _ = await _run_blocking(_classify_timed, features)

        return {
            "status": "success",
            "overview": {
                "speakerCount":     speaker_count,
                "audioDuration":    features.get("duration", 0),
                "predictedGender":  classification_results.get("gender"),
                "predictedAgeGroup": classification_results.get("age"),
                "speechPattern":    classification_results.get("speech_pattern"),
                "speechHealthScore": classification_results.get("health_score", 85),
            },
            "rawTranscription":       transcription_dict.get("raw", []),
            "correctedTranscription": transcription_dict.get("corrected", []),
            "pipelineInfo":           transcription_dict.get("pipeline", {}),
            "acousticFeatures":       features,
            "classification":         classification_results,
        }

    except Exception as exc:
        logger.error(f"Error processing audio: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if file_path.exists():
            try:
                os.remove(file_path)
            except Exception as ex:
                logger.warning(f"Could not remove temp file {file_path}: {ex}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8008, reload=False)
