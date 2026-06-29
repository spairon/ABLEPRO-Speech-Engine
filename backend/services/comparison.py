import logging
from services.audio_features import extract_features
from services.classifier import predict_diagnostics

logger = logging.getLogger(__name__)

def generate_comparison_scores(conv_features, word_features, conv_class, word_class):
    """
    Compare Conversation (C) vs Word Repetition (W) features to generate composite scores.
    """
    try:
        # 1. Fluency Score (0-100)
        # Based on Conversation Pause Ratio and Speaking Rate.
        c_dur = conv_features.get("duration", 1)
        c_pause = conv_features.get("pause_duration", 0)
        c_rate = conv_features.get("speaking_rate", 2.0)
        
        c_pause_ratio = c_pause / c_dur if c_dur > 0 else 0
        
        # Penalize if pause ratio > 30%
        fluency = 100 - (max(0, c_pause_ratio - 0.3) * 150)
        # Bonus for good speaking rate
        if c_rate >= 2.0 and c_rate <= 5.0:
            fluency += 5
        fluency = max(0, min(100, fluency))

        # 2. Pronunciation Score (0-100)
        # Uses Word Repetition clarity (Jitter/Shimmer) as an proxy for phonetic control
        w_jitter = word_features.get("jitter", 0.02)
        w_shimmer = word_features.get("shimmer", 0.03)
        
        jitter_pen  = min(w_jitter / 0.04, 2.0) * 20
        shimmer_pen = min(w_shimmer / 0.06, 2.0) * 20
        pronunciation = 100 - jitter_pen - shimmer_pen
        pronunciation = max(0, min(100, pronunciation))

        # 3. Consistency Score (0-100)
        # How similar is the pitch across both tasks? Huge variance means lack of control.
        c_pitch = conv_features.get("pitch_mean", 1)
        w_pitch = word_features.get("pitch_mean", 1)
        pitch_diff = abs(c_pitch - w_pitch) / max(1, c_pitch)
        
        consistency = 100 - (pitch_diff * 100)
        consistency = max(0, min(100, consistency))
        
        # 4. Overall Health Score
        health = (fluency + pronunciation + consistency + conv_class.get("health_score", 0)) / 4

        return {
            "fluency": round(fluency),
            "pronunciation": round(pronunciation),
            "consistency": round(consistency),
            "overall_health": round(health),
            "analysis": {
                "conversation": {
                    "duration": round(c_dur, 2),
                    "speaking_rate": round(c_rate, 2),
                    "pause_ratio": round(c_pause_ratio, 2),
                    "pattern": conv_class.get("speech_pattern", {}).get("prediction", "Unknown")
                },
                "word_repetition": {
                    "duration": round(word_features.get("duration", 1), 2),
                    "jitter": round(w_jitter, 4),
                    "shimmer": round(w_shimmer, 4),
                    "pattern": word_class.get("speech_pattern", {}).get("prediction", "Unknown")
                }
            }
        }
    except Exception as e:
        logger.error(f"Comparison generation failed: {e}")
        return {
            "fluency": 0, "pronunciation": 0, "consistency": 0, "overall_health": 0,
            "analysis": {"conversation": {}, "word_repetition": {}}
        }
