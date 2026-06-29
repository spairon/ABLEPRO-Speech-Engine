import React from 'react';

const cardStyle = {
  background: 'rgba(26,35,50,0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '1rem',
  padding: '1.5rem',
  marginBottom: '1.5rem'
};

const PipelineArchitecture = () => {
  return (
    <div style={cardStyle}>
      <h3 style={{color:'#F3F4F6', fontSize:'1.25rem', marginTop:0, marginBottom:'1rem', display:'flex', alignItems:'center', gap:'0.5rem'}}>
        ⚙️ Pipeline Architecture & Models
      </h3>
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'1rem'}}>
        
        {/* Preprocessing */}
        <div style={{background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', padding:'1rem', borderRadius:'0.5rem'}}>
          <h4 style={{color:'#10B981', margin:'0 0 0.5rem 0', fontSize:'0.9rem'}}>Data Preprocessing</h4>
          <p style={{fontSize:'0.8rem', color:'#D1D5DB', margin:0, lineHeight:'1.5'}}>
            Audio Input ➔ Validation ➔ Mono Conversion ➔ 16kHz Resampling ➔ Loudness Normalization ➔ Spectral Denoise
          </p>
        </div>

        {/* STT */}
        <div style={{background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', padding:'1rem', borderRadius:'0.5rem'}}>
          <h4 style={{color:'#3B82F6', margin:'0 0 0.5rem 0', fontSize:'0.9rem'}}>Speech-to-Text</h4>
          <ul style={{fontSize:'0.8rem', color:'#D1D5DB', margin:0, paddingLeft:'1.2rem', lineHeight:'1.5'}}>
            <li><b>Primary (Online):</b> Sarvam Saaras v3</li>
            <li><b>Fallback (Offline):</b> Whisper Large-v3 (GPU)</li>
          </ul>
        </div>

        {/* Diarization */}
        <div style={{background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', padding:'1rem', borderRadius:'0.5rem'}}>
          <h4 style={{color:'#8B5CF6', margin:'0 0 0.5rem 0', fontSize:'0.9rem'}}>Speaker & VAD</h4>
          <ul style={{fontSize:'0.8rem', color:'#D1D5DB', margin:0, paddingLeft:'1.2rem', lineHeight:'1.5'}}>
            <li><b>Speaker Diarization:</b> Pyannote 3.1</li>
            <li><b>Voice Activity Detection:</b> Silero VAD</li>
          </ul>
        </div>

        {/* Features & Class */}
        <div style={{background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', padding:'1rem', borderRadius:'0.5rem'}}>
          <h4 style={{color:'#F59E0B', margin:'0 0 0.5rem 0', fontSize:'0.9rem'}}>Classification</h4>
          <ul style={{fontSize:'0.8rem', color:'#D1D5DB', margin:0, paddingLeft:'1.2rem', lineHeight:'1.5'}}>
            <li><b>Feature Extraction:</b> Librosa</li>
            <li><b>Inference:</b> Clinical Rule Engine + Random Forest</li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default PipelineArchitecture;
