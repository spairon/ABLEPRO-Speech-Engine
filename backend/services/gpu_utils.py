"""
gpu_utils.py
------------
Centralized GPU detection and configuration for the ABLEPRO pipeline.

Exports:
    DEVICE        - "cuda" or "cpu"
    COMPUTE_TYPE  - "float16" or "int8"
    IS_CUDA       - bool
    TORCH_DEVICE  - torch.device object (for pyannote / other torch models)
    GPU_INFO      - dict with name, vram, etc.

Prints a startup banner showing GPU status.
Raises RuntimeError (when CUDA_FAIL_HARD=true) or emits a warning
(default) if CUDA is requested but unavailable — never silently falls
back to CPU without notification.
"""

import logging
import os

logger = logging.getLogger(__name__)

# ── Read preferences from env ─────────────────────────────────────────────────
_REQUESTED_DEVICE  = os.getenv("WHISPER_DEVICE",       "cuda").lower()
_REQUESTED_COMPUTE = os.getenv("WHISPER_COMPUTE_TYPE", "float16").lower()
_CUDA_FAIL_HARD    = os.getenv("CUDA_FAIL_HARD",       "false").lower() == "true"

# ── Detect GPU ────────────────────────────────────────────────────────────────
IS_CUDA      = False
GPU_INFO     = {}
DEVICE       = "cpu"
COMPUTE_TYPE = "int8"

# torch.device reference — populated below if torch is available
try:
    import torch
    TORCH_DEVICE = torch.device("cpu")   # default; overwritten if CUDA found
except ImportError:
    TORCH_DEVICE = None                  # torch not installed

try:
    import torch

    if torch.cuda.is_available():
        IS_CUDA      = True
        DEVICE       = "cuda"
        COMPUTE_TYPE = _REQUESTED_COMPUTE          # honour float16 / int8_float16
        TORCH_DEVICE = torch.device("cuda")

        dev        = torch.cuda.current_device()
        gpu_name   = torch.cuda.get_device_name(dev)
        vram_bytes = torch.cuda.get_device_properties(dev).total_memory
        vram_gb    = round(vram_bytes / (1024 ** 3), 1)

        GPU_INFO = {
            "gpu_name":     gpu_name,
            "cuda_enabled": True,
            "vram_gb":      vram_gb,
            "device":       DEVICE,
            "compute_type": COMPUTE_TYPE,
        }
        logger.info(
            f"[OK] CUDA available: {gpu_name}  "
            f"({vram_gb} GB VRAM, {COMPUTE_TYPE})"
        )

    else:
        # CUDA unavailable
        GPU_INFO = {
            "gpu_name":     "N/A",
            "cuda_enabled": False,
            "vram_gb":      0,
            "device":       "cpu",
            "compute_type": "int8",
        }

        if _REQUESTED_DEVICE == "cuda":
            msg = (
                "[WARN] CUDA was requested (WHISPER_DEVICE=cuda) but is NOT available "
                "on this machine.\n"
                "   Check that your NVIDIA drivers and CUDA toolkit are installed "
                "and that PyTorch was built with CUDA support.\n"
                "   Set CUDA_FAIL_HARD=true in .env to raise an error instead of "
                "continuing on CPU."
            )
            if _CUDA_FAIL_HARD:
                raise RuntimeError(msg)
            logger.warning(msg)
            logger.warning("[WARN] Falling back to CPU. Performance will be significantly degraded.")

except ImportError:
    GPU_INFO = {
        "gpu_name":     "N/A",
        "cuda_enabled": False,
        "vram_gb":      0,
        "device":       "cpu",
        "compute_type": "int8",
    }
    logger.warning(
        "[WARN] PyTorch is not installed. Cannot detect GPU. Running on CPU.\n"
        "   Install with:  pip install torch torchvision torchaudio --index-url "
        "https://download.pytorch.org/whl/cu121"
    )


# ── Print startup banner ──────────────────────────────────────────────────────
def print_gpu_banner() -> None:
    """Print a GPU status block to stdout at server startup."""
    from services.transcription import WHISPER_MODEL_SIZE
    sep = "=" * 54
    print(f"\n{sep}")
    print(f"GPU: {GPU_INFO.get('gpu_name', 'N/A')}")
    print(f"CUDA: {'Enabled' if IS_CUDA else 'Disabled'}")
    print(f"VRAM: {GPU_INFO.get('vram_gb', 0)} GB")
    print(f"Whisper Model: {WHISPER_MODEL_SIZE}")
    print(f"Device: {DEVICE.upper()}")
    print(f"Precision: {COMPUTE_TYPE}")
    print(sep + "\n")
