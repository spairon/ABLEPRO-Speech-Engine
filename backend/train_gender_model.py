import os
import sys
import pickle
import numpy as np
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add current dir to path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.audio_features import extract_features
from sklearn.ensemble import RandomForestClassifier

DATASETS_DIR = Path("../Datasets")
MODELS_DIR = Path("models")
MODELS_DIR.mkdir(exist_ok=True)

def auto_label_gender(pitch_mean):
    """Fallback rule-based logic to auto-label data since we lack ground truth."""
    if pitch_mean == 0:
        return None
    return "Male" if pitch_mean < 165.0 else "Female"

def main():
    logger.info("Starting dataset processing for Random Forest training...")
    X = []
    y = []

    if not DATASETS_DIR.exists():
        logger.error(f"Directory {DATASETS_DIR} not found.")
        return

    wav_files = list(DATASETS_DIR.glob("*.wav"))
    if not wav_files:
        logger.warning(f"No wav files found in {DATASETS_DIR}.")
        return

    for i, file_path in enumerate(wav_files):
        logger.info(f"Processing {i+1}/{len(wav_files)}: {file_path.name}")
        features = extract_features(str(file_path))
        
        pitch_mean = features.get("pitch_mean", 0)
        label = auto_label_gender(pitch_mean)
        if not label:
            logger.info("  Skipping (pitch_mean = 0)")
            continue
            
        # Features: Pitch, MFCC (13), Formants (3), Spectral Centroid, RMS Energy, Speaking Rate, Jitter, Shimmer
        feature_vector = [
            pitch_mean,
            features.get("spectral_centroid", 0),
            features.get("rms_energy", 0),
            features.get("speaking_rate", 0),
            features.get("jitter", 0),
            features.get("shimmer", 0),
        ]
        
        formants = features.get("formants", [0, 0, 0])
        feature_vector.extend(formants)
        
        mfccs = features.get("mfcc_1_13", [0]*13)
        feature_vector.extend(mfccs)
        
        X.append(feature_vector)
        y.append(label)

    if not X:
        logger.error("No valid features extracted. Training aborted.")
        return

    X = np.array(X)
    y = np.array(y)

    logger.info(f"Extracted {len(X)} samples. Training Random Forest...")
    
    # Random Forest Classifier
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X, y)
    
    # Evaluate on training data (just to verify learning)
    acc = rf.score(X, y)
    logger.info(f"Training accuracy (on auto-labeled data): {acc*100:.2f}%")
    
    feature_names = [
        "Pitch (F0)", "Spectral Centroid", "RMS Energy", "Speaking Rate", "Jitter", "Shimmer",
        "Formant 1", "Formant 2", "Formant 3"
    ] + [f"MFCC_{i+1}" for i in range(13)]
    
    # Save the model and feature names
    model_path = MODELS_DIR / "gender_rf.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": rf,
            "feature_names": feature_names,
            "classes": rf.classes_
        }, f)
        
    logger.info(f"Random Forest model saved to {model_path}")

if __name__ == "__main__":
    main()
