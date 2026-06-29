import React from 'react';

const PerformanceProfiler = ({ timings }) => {
  if (!timings) return null;

  const order = [
    { key: 'audio', label: 'Audio Loading & Downsample' },
    { key: 'denoise', label: 'Spectral Noise Reduction' },
    { key: 'diarization', label: 'Pyannote Diarization' },
    { key: 'feature_extraction', label: 'Acoustic Feature Extraction' },
    { key: 'transcription', label: 'Primary STT Inference' },
    { key: 'classification', label: 'RF Classification & Rules' },
  ];

  return (
    <div style={{
      background: 'rgba(26,35,50,0.7)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem',
      padding: '1.5rem', marginBottom: '1.5rem'
    }}>
      <h3 style={{color:'#F3F4F6', fontSize:'1.25rem', marginTop:0, marginBottom:'1rem'}}>⏱️ Pipeline Performance Profiler</h3>
      
      <div style={{width:'100%', overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', color:'#D1D5DB', fontSize:'0.9rem'}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
              <th style={{textAlign:'left', padding:'0.75rem 0.5rem', color:'#9CA3AF', fontWeight:600}}>Stage</th>
              <th style={{textAlign:'right', padding:'0.75rem 0.5rem', color:'#9CA3AF', fontWeight:600}}>Execution Time (ms)</th>
              <th style={{textAlign:'right', padding:'0.75rem 0.5rem', color:'#9CA3AF', fontWeight:600}}>Time (sec)</th>
            </tr>
          </thead>
          <tbody>
            {order.map((stage) => {
              const t = timings[stage.key];
              if (t === undefined) return null;
              return (
                <tr key={stage.key} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding:'0.75rem 0.5rem'}}>{stage.label}</td>
                  <td style={{textAlign:'right', padding:'0.75rem 0.5rem', fontFamily:'monospace'}}>{Math.round(t * 1000)} ms</td>
                  <td style={{textAlign:'right', padding:'0.75rem 0.5rem', fontFamily:'monospace', color:'#60A5FA'}}>{t.toFixed(2)} s</td>
                </tr>
              );
            })}
            <tr style={{background:'rgba(255,255,255,0.02)'}}>
              <td style={{padding:'1rem 0.5rem', fontWeight:700, color:'#F3F4F6'}}>Total Pipeline Time</td>
              <td style={{textAlign:'right', padding:'1rem 0.5rem', fontFamily:'monospace', fontWeight:700, color:'#F3F4F6'}}>{Math.round(timings.total * 1000)} ms</td>
              <td style={{textAlign:'right', padding:'1rem 0.5rem', fontFamily:'monospace', fontWeight:700, color:'#10B981'}}>{timings.total.toFixed(2)} s</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PerformanceProfiler;
