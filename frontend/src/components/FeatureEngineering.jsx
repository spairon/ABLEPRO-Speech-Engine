import React from 'react';

const FeatureEngineering = ({ features }) => {
  if (!features) return null;

  const getExplanation = (key) => {
    const explanations = {
      pitch_mean: "Pitch (F0): How high or low the voice is. Used to guess if the speaker is a man, woman, or child.",
      pitch_variance: "Pitch Spread: How much the voice goes up and down. A flat line means monotone, while a lot of movement means expressive speaking.",
      rms_energy: "Loudness: Measures the overall volume and energy of the speech.",
      spectral_centroid: "Brightness: Measures if the voice sounds deep and bass-heavy, or bright and sharp.",
      spectral_bandwidth: "Frequency Range: Measures how wide the sound waves are spread out.",
      spectral_rolloff: "Sound Cutoff: Helps the AI tell the difference between actual speech and background noise.",
      zero_crossing_rate: "Scratchiness: High numbers usually mean the audio is noisy, breathy, or has a lot of static.",
      speaking_rate: "Talking Speed: How fast the person is speaking (words or sounds per second).",
      pause_duration: "Silence: The total amount of time the speaker spent pausing or hesitating.",
      jitter: "Voice Shakiness (Pitch): If this is too high, the voice sounds hoarse or unstable.",
      shimmer: "Voice Shakiness (Volume): If this is too high, the voice sounds breathy or weak.",
    };
    return explanations[key] || "Acoustic measurement extracted via Librosa.";
  };

  const formatValue = (key, val) => {
    if (key === 'mfcc_1_13' || key === 'formants') return "Array Data";
    if (key.includes('pitch') || key.includes('centroid') || key.includes('bandwidth') || key.includes('rolloff')) return `${val} Hz`;
    if (key === 'pause_duration' || key === 'duration') return `${val} sec`;
    if (key === 'speaking_rate') return `${val} onsets/s`;
    return val;
  };

  const skipKeys = ['mfcc_1_13', 'formants', 'duration'];
  const entries = Object.entries(features).filter(([k]) => !skipKeys.includes(k));

  return (
    <div style={{
      background: 'rgba(26,35,50,0.7)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem',
      padding: '1.5rem', marginBottom: '1.5rem'
    }}>
      <h3 style={{color:'#F3F4F6', fontSize:'1.25rem', marginTop:0, marginBottom:'1rem'}}>🔬 Feature Engineering Pipeline</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'1rem'}}>
        {entries.map(([k, v]) => (
          <div key={k} style={{background:'rgba(255,255,255,0.03)', padding:'1rem', borderRadius:'0.5rem', border:'1px solid rgba(255,255,255,0.05)'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.25rem'}}>
              <span style={{color:'#9CA3AF', fontWeight:600, textTransform:'capitalize'}}>{k.replace(/_/g, ' ')}</span>
              <span style={{color:'#60A5FA', fontWeight:700}}>{formatValue(k, v)}</span>
            </div>
            <p style={{fontSize:'0.75rem', color:'#6B7280', margin:0, lineHeight:'1.4'}}>
              {getExplanation(k)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeatureEngineering;
