import React from 'react';

const ErrorAnalysis = ({ pipelineInfo }) => {
  if (!pipelineInfo) return null;

  const isFallback = pipelineInfo.stt_engine && pipelineInfo.stt_engine.includes('Whisper');
  const errorReason = pipelineInfo.error_reason || 'Unknown API Error or Quota Exceeded';

  return (
    <div style={{
      background: 'rgba(26,35,50,0.7)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem',
      padding: '1.5rem', marginBottom: '1.5rem'
    }}>
      <h3 style={{color:'#F3F4F6', fontSize:'1.25rem', marginTop:0, marginBottom:'1rem'}}>⚠️ Error & Failover Analysis</h3>
      
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
        {/* Known Failures */}
        <div>
          <h4 style={{color:'#9CA3AF', margin:'0 0 0.5rem 0'}}>Known Clinical Failure Cases</h4>
          <ul style={{color:'#D1D5DB', fontSize:'0.85rem', margin:0, paddingLeft:'1.2rem', lineHeight:'1.6'}}>
            <li>Heavy clinical background noise (e.g. MRI machines)</li>
            <li>Multiple speakers talking simultaneously (Cross-talk)</li>
            <li>Extremely rare Kannada medical terminology (Out of Vocabulary)</li>
            <li>Cloud STT API timeouts / offline environments</li>
          </ul>
        </div>

        {/* Dynamic Fallback Graph */}
        <div style={{background:'rgba(0,0,0,0.2)', padding:'1rem', borderRadius:'0.5rem', border:'1px solid rgba(255,255,255,0.05)'}}>
          <h4 style={{color:'#9CA3AF', margin:'0 0 1rem 0'}}>Failover Execution Graph</h4>
          {isFallback ? (
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem'}}>
              <div style={{background:'rgba(239,68,68,0.1)', color:'#EF4444', padding:'0.5rem 1rem', borderRadius:'0.25rem', border:'1px solid #EF4444', fontSize:'0.9rem'}}>
                Primary Engine Failed (Sarvam AI)
              </div>
              <span style={{color:'#9CA3AF'}}>↓</span>
              <div style={{color:'#F59E0B', fontSize:'0.8rem', fontStyle:'italic', textAlign:'center'}}>
                Reason: {errorReason}
              </div>
              <span style={{color:'#9CA3AF'}}>↓</span>
              <div style={{background:'rgba(16,185,129,0.1)', color:'#10B981', padding:'0.5rem 1rem', borderRadius:'0.25rem', border:'1px solid #10B981', fontSize:'0.9rem'}}>
                Offline GPU Used (Whisper Large-v3)
              </div>
            </div>
          ) : (
            <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#10B981', fontWeight:500}}>
              ✅ Primary Pipeline Succeeded. Zero Failovers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorAnalysis;
