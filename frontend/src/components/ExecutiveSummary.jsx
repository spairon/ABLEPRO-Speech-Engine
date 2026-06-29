import React from 'react';

const ExecutiveSummary = ({ data }) => {
  if (!data || !data.overview || !data.classification) return null;
  
  const o = data.overview;
  const c = data.classification;
  
  const gender = c.gender?.prediction || "Unknown";
  const age = c.age?.prediction || "Unknown";
  const health = c.health_score || 0;
  
  const engine = data.pipelineInfo?.stt_engine || "Unknown";
  const totalTime = data.performanceTimings?.total ? `${data.performanceTimings.total.toFixed(2)}s` : "--";

  let diagnosticSummary = `Patient is identified as a ${age} ${gender}. `;
  if (health >= 85) diagnosticSummary += "Vocal health is well within normal clinical limits.";
  else if (health >= 60) diagnosticSummary += "Mild vocal perturbations detected. Recommend monitoring.";
  else diagnosticSummary += "Significant vocal anomalies (Atypical Speech Pattern) detected. Recommend clinical follow-up.";

  const itemStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '0.5rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  };

  const labelStyle = { color: '#9CA3AF', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const valStyle = { color: '#F3F4F6', fontSize: '1.25rem', fontWeight: 700 };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,58,138,0.4) 0%, rgba(17,24,39,0.9) 100%)',
      backdropFilter: 'blur(16px)', border: '1px solid rgba(96,165,250,0.3)',
      borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
    }}>
      <h2 style={{color: '#60A5FA', fontSize: '1.75rem', marginTop: 0, marginBottom: '1.5rem'}}>🏆 Executive Summary (Demo Mode)</h2>
      
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem'}}>
        <div style={itemStyle}>
          <span style={labelStyle}>Audio Duration</span>
          <span style={valStyle}>{o.audioDuration}s</span>
        </div>
        <div style={itemStyle}>
          <span style={labelStyle}>Speakers</span>
          <span style={valStyle}>{o.speakerCount}</span>
        </div>
        <div style={itemStyle}>
          <span style={labelStyle}>STT Engine</span>
          <span style={{...valStyle, color:'#F59E0B', fontSize:'1rem'}}>{engine.includes('Whisper') ? 'Whisper (GPU)' : 'Sarvam API'}</span>
        </div>
        <div style={itemStyle}>
          <span style={labelStyle}>Processing Time</span>
          <span style={{...valStyle, color:'#10B981'}}>{totalTime}</span>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem'}}>
        <div style={itemStyle}>
          <span style={labelStyle}>Gender</span>
          <span style={valStyle}>{gender}</span>
        </div>
        <div style={itemStyle}>
          <span style={labelStyle}>Age Group</span>
          <span style={valStyle}>{age}</span>
        </div>
        <div style={itemStyle}>
          <span style={labelStyle}>Health Score</span>
          <span style={{...valStyle, color: health >= 85 ? '#10B981' : health >= 60 ? '#F59E0B' : '#EF4444'}}>
            {health} / 100
          </span>
        </div>
      </div>

      <div style={{background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '0.5rem', borderLeft: '4px solid #60A5FA'}}>
        <h4 style={{color: '#9CA3AF', margin: '0 0 0.5rem 0', textTransform: 'uppercase', fontSize: '0.8rem'}}>Overall Diagnostic Summary</h4>
        <p style={{color: '#E5E7EB', margin: 0, fontSize: '1.1rem', lineHeight: '1.5'}}>
          {diagnosticSummary}
        </p>
      </div>
    </div>
  );
};

export default ExecutiveSummary;
