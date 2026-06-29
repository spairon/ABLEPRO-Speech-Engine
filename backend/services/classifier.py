"""
classifier.py
-------------
Hybrid ML and Rule-based speech classifier with Explainable AI (XAI).

- Gender: Random Forest model trained on acoustic features.
- Age / Pattern: Clinical/acoustic research thresholds.

References:
  • Titze (1994): fundamental frequency norms — adult male ~80-165 Hz, adult female ~165-255 Hz, children >260 Hz
  • Baken & Orlikoff (2000): jitter <1% (0.01) and shimmer <3 dB are normal. Clinical atypical thresholds: jitter >0.04, shimmer >0.06.
"""

import logging
import math
import pickle
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load ML Model
# ---------------------------------------------------------------------------
RF_MODEL = None
RF_FEATURE_NAMES = None
RF_CLASSES = None

try:
    model_path = Path(__file__).parent.parent / "models" / "gender_rf.pkl"
    if model_path.exists():
        with open(model_path, "rb") as f:
            data = pickle.load(f)
            RF_MODEL = data["model"]
            RF_FEATURE_NAMES = data["feature_names"]
            RF_CLASSES = data["classes"]
        logger.info("Successfully loaded Random Forest model for Gender Prediction.")
    else:
        logger.warning(f"Random Forest model not found at {model_path}. Falling back to rules.")
except Exception as e:
    logger.error(f"Failed to load RF model: {e}")


# ---------------------------------------------------------------------------
# Clinical / acoustic research thresholds
# ---------------------------------------------------------------------------

F0_GENDER_BOUNDARY_HZ = 165.0
F0_CHILD_MIN_HZ       = 220.0
SC_CHILD_MIN_HZ       = 3400.0
JITTER_ATYPICAL       = 0.04
SHIMMER_ATYPICAL      = 0.06
PAUSE_ATYPICAL_SEC    = 3.0


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _gender_prediction(features: dict):
    """
    Random Forest gender classification with Explainability.
    """
    pitch_mean = float(features.get("pitch_mean", 0) or 0)
    
    if pitch_mean <= 0:
        return "Unknown", 50.0, {"Male": 50.0, "Female": 50.0}, "No voiced speech detected.", []

    if RF_MODEL is not None:
        try:
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
            
            X = np.array([feature_vector])
            
            probs = RF_MODEL.predict_proba(X)[0]
            pred_idx = np.argmax(probs)
            pred_label = RF_CLASSES[pred_idx]
            confidence = round(probs[pred_idx] * 100, 1)
            
            prob_dict = {str(c): round(p * 100, 1) for c, p in zip(RF_CLASSES, probs)}
            
            # Explainability: Top features
            importances = RF_MODEL.feature_importances_
            top_indices = np.argsort(importances)[::-1][:3]
            top_features = [{"name": RF_FEATURE_NAMES[i], "importance": round(importances[i]*100, 1)} for i in top_indices]
            
            reasoning = f"Random Forest predicted {pred_label} with {confidence}% confidence. Primary contributing features were {top_features[0]['name']} and {top_features[1]['name']}."
            
            return pred_label, confidence, prob_dict, reasoning, top_features
            
        except Exception as e:
            logger.error(f"RF prediction failed: {e}. Falling back to rules.")

    # Fallback to Weighted Multi-Feature Rule Engine
    rms_energy = float(features.get("rms_energy", 0.05) or 0.05)
    speaking_rate = float(features.get("speaking_rate", 3.0) or 3.0)
    spectral_centroid = float(features.get("spectral_centroid", 2000.0) or 2000.0)
    mfcc_mean = features.get("mfcc_1_13", [0]*13)
    mfcc_0 = mfcc_mean[0] if len(mfcc_mean) > 0 else 0

    # 40% Pitch
    f0_score = (pitch_mean - F0_GENDER_BOUNDARY_HZ) / 40.0
    f0_reason = "Female range" if pitch_mean > F0_GENDER_BOUNDARY_HZ else "Male range"
    
    # 20% Centroid
    sc_score = (spectral_centroid - 2500.0) / 1000.0
    sc_reason = "Female profile" if spectral_centroid > 2500 else "Male profile"

    # 20% MFCC
    mfcc_score = (mfcc_0 + 300) / 100.0
    mfcc_reason = "Female profile" if mfcc_0 > -300 else "Male profile"

    # 10% Energy
    energy_score = 0.5 if rms_energy < 0.04 else -0.2
    energy_reason = "Normal"

    # 10% Rate
    rate_score = (speaking_rate - 4.0) / 2.0
    rate_reason = "Normal"

    raw_score = (0.4 * f0_score) + (0.2 * sc_score) + (0.2 * mfcc_score) + (0.1 * energy_score) + (0.1 * rate_score)
    
    p_female = round(_sigmoid(raw_score) * 100, 1)
    p_male   = round(100.0 - p_female, 1)

    label = "Female" if p_female >= p_male else "Male"
    conf = p_female if label == "Female" else p_male
    
    reasoning = f"Rule-based prediction. Pitch: {f0_reason} ({pitch_mean:.1f}Hz) | Centroid: {sc_reason} ({spectral_centroid:.1f}Hz) | MFCC: {mfcc_reason} | Energy: {energy_reason}"
    
    top_features = [
        {"name": "Pitch (F0)", "importance": 40},
        {"name": "Spectral Centroid", "importance": 20},
        {"name": "MFCC Base", "importance": 20}
    ]
    return label, conf, {"Male": p_male, "Female": p_female}, reasoning, top_features


def _age_prediction(pitch_mean: float, spectral_centroid: float):
    if pitch_mean <= 0:
        return "Adult", 70.0, {"Adult": 70.0, "Child": 30.0}, "No voiced speech detected.", []

    f0_child_score = (pitch_mean - F0_CHILD_MIN_HZ) / 50.0
    sc_child_score = (spectral_centroid - SC_CHILD_MIN_HZ) / 500.0

    raw_score = (f0_child_score + sc_child_score) / 2.0
    p_child = round(_sigmoid(raw_score) * 100, 1)
    p_adult = round(100.0 - p_child, 1)

    label = "Child" if p_child >= p_adult else "Adult"
    conf = p_child if label == "Child" else p_adult
    
    # Explainability
    if label == "Child":
        reasoning = f"Child profile predicted. Pitch ({pitch_mean:.1f}Hz) and Spectral Centroid ({spectral_centroid:.1f}Hz) exceed adult clinical norms."
    else:
        reasoning = f"Adult profile predicted. Pitch ({pitch_mean:.1f}Hz) is within typical adult clinical thresholds."

    top_features = [{"name": "Pitch (F0)", "importance": 60}, {"name": "Spectral Centroid", "importance": 40}]

    return label, conf, {"Adult": p_adult, "Child": p_child}, reasoning, top_features


def _pattern_prediction(jitter: float, shimmer: float, pause_duration: float, duration: float):
    jitter_excess  = min(jitter  / JITTER_ATYPICAL,  2.0) - 1.0
    shimmer_excess = min(shimmer / SHIMMER_ATYPICAL, 2.0) - 1.0

    pause_ratio = (pause_duration / duration) if duration > 0 else 0
    pause_excess = (pause_ratio - 0.4) / 0.3

    raw_score = 0.45 * jitter_excess + 0.35 * shimmer_excess + 0.20 * pause_excess
    p_atypical = round(_sigmoid(raw_score * 3) * 100, 1)
    p_typical  = round(100.0 - p_atypical, 1)

    label = "Atypical" if p_atypical >= p_typical else "Typical"
    conf = p_atypical if label == "Atypical" else p_typical
    
    # Explainability
    issues = []
    if jitter > JITTER_ATYPICAL: issues.append(f"Jitter ({jitter:.3f}) > {JITTER_ATYPICAL}")
    if shimmer > SHIMMER_ATYPICAL: issues.append(f"Shimmer ({shimmer:.3f}) > {SHIMMER_ATYPICAL}")
    if pause_ratio > 0.4: issues.append(f"Pause Ratio ({pause_ratio*100:.1f}%) > 40%")
    
    if label == "Atypical":
        reasoning = "Atypical pattern detected due to clinical perturbations: " + ", ".join(issues) + "."
    else:
        reasoning = f"Typical speech pattern. Perturbations are within healthy limits (Jitter: {jitter:.3f}, Shimmer: {shimmer:.3f})."

    top_features = [
        {"name": "Jitter", "importance": 45}, 
        {"name": "Shimmer", "importance": 35},
        {"name": "Pause Ratio", "importance": 20}
    ]

    return label, conf, {"Typical": p_typical, "Atypical": p_atypical}, reasoning, top_features


def _compute_health_score(jitter: float, shimmer: float, p_atypical: float) -> int:
    jitter_pen  = min(jitter  / JITTER_ATYPICAL,  2.0) * 25.0
    shimmer_pen = min(shimmer / SHIMMER_ATYPICAL, 2.0) * 15.0
    atypical_pen = (p_atypical / 100.0) * 10.0

    raw = 100.0 - jitter_pen - shimmer_pen - atypical_pen
    return max(0, min(100, round(raw)))


def predict_diagnostics(features: dict) -> dict:
    try:
        pitch_mean        = float(features.get("pitch_mean", 0) or 0)
        jitter            = float(features.get("jitter", 0.02) or 0.02) * 0.1
        shimmer           = float(features.get("shimmer", 0.03) or 0.03) * 0.1
        pause_duration    = float(features.get("pause_duration", 1.0) or 1.0)
        duration          = float(features.get("duration", 1.0) or 1.0)
        spectral_centroid = float(features.get("spectral_centroid", 2500) or 2500)

        # Gender
        gender_label, gender_conf, gender_probs, g_reasoning, g_top = _gender_prediction(features)
        
        # Age
        age_label, age_conf, age_probs, a_reasoning, a_top = _age_prediction(pitch_mean, spectral_centroid)
        
        # Pattern
        pattern_label, pattern_conf, pattern_probs, p_reasoning, p_top = _pattern_prediction(jitter, shimmer, pause_duration, duration)

        # Health
        health_score = _compute_health_score(jitter, shimmer, pattern_probs.get("Atypical", 0))

        return {
            "gender": {
                "prediction":    gender_label,
                "confidence":    gender_conf,
                "probabilities": gender_probs,
                "reasoning":     g_reasoning,
                "top_features":  g_top,
                "clinical_interpretation": "Analyzed using Random Forest based on fundamental frequency and timbre."
            },
            "age": {
                "prediction":    age_label,
                "confidence":    age_conf,
                "probabilities": age_probs,
                "reasoning":     a_reasoning,
                "top_features":  a_top,
                "clinical_interpretation": "Analyzed against Titze (1994) and Kent (1994) norms."
            },
            "speech_pattern": {
                "prediction":    pattern_label,
                "confidence":    pattern_conf,
                "probabilities": pattern_probs,
                "reasoning":     p_reasoning,
                "top_features":  p_top,
                "clinical_interpretation": "Analyzed against Baken & Orlikoff (2000) clinical thresholds."
            },
            "health_score": health_score,
        }

    except Exception as e:
        logger.error(f"Classification error: {e}", exc_info=True)
        return {
            "gender":         {"prediction": "Unknown", "confidence": 0, "probabilities": {}, "reasoning": "Error", "top_features": []},
            "age":            {"prediction": "Unknown", "confidence": 0, "probabilities": {}, "reasoning": "Error", "top_features": []},
            "speech_pattern": {"prediction": "Unknown", "confidence": 0, "probabilities": {}, "reasoning": "Error", "top_features": []},
            "health_score":   0,
        }
