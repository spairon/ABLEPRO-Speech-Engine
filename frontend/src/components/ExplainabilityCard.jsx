import React from 'react';

const ExplainabilityCard = ({ classification }) => {
  if (!classification) return null;

  const renderSection = (title, data) => {
    if (!data || !data.reasoning) return null;
    
    // Attempt to extract confidence if available in data
    // Assuming classifier returns data containing confidence or probabilities
    const conf = data.confidence || (data.probabilities && data.probabilities[data.prediction]) || null;
    const confidenceDisplay = conf ? `${conf}% Confidence` : 'Prediction';

    return (
      <div style={{background:'rgba(255,255,255,0.03)', padding:'1.25rem', borderRadius:'0.5rem', border:'1px solid rgba(255,255,255,0.05)', marginBottom:'1rem'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem'}}>
          <div>
            <h4 style={{color:'#E5E7EB', margin:0, fontSize:'1.05rem'}}>{title}</h4>
            {conf && (
              <span style={{
                display:'inline-block', marginTop:'0.25rem', padding:'2px 6px', 
                borderRadius:'4px', fontSize:'0.7rem', fontWeight:600,
                background: conf > 80 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                color: conf > 80 ? '#10B981' : '#F59E0B',
              }}>
                {confidenceDisplay}
              </span>
            )}
          </div>
          <span style={{color:'#60A5FA', fontWeight:700, fontSize:'1.25rem', textShadow:'0 0 10px rgba(96,165,250,0.3)'}}>{data.prediction}</span>
        </div>
        
        <p style={{color:'#9CA3AF', fontSize:'0.85rem', margin:'0 0 0.75rem 0', fontStyle:'italic', lineHeight:'1.4'}}>
          {data.clinical_interpretation}
        </p>
        
        <div style={{background:'rgba(59,130,246,0.08)', padding:'1rem', borderRadius:'0.5rem', borderLeft:'4px solid #3B82F6'}}>
          <h5 style={{color:'#9CA3AF', margin:'0 0 0.5rem 0', fontSize:'0.75rem', textTransform:'uppercase'}}>Diagnostic Reasoning</h5>
          <p style={{margin:0, color:'#D1D5DB', fontSize:'0.85rem', lineHeight:'1.6'}}>
            {data.reasoning}
          </p>
        </div>
        
        {data.top_features && data.top_features.length > 0 && (
          <div style={{marginTop:'1rem', display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center'}}>
            <span style={{color:'#6B7280', fontSize:'0.75rem', textTransform:'uppercase'}}>Weighted Features:</span>
            {data.top_features.map((tf, i) => (
              <span key={i} style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', padding:'2px 8px', borderRadius:'1rem', fontSize:'0.75rem', color:'#E5E7EB'}}>
                {tf.name} <span style={{color:'#60A5FA'}}>{tf.importance}%</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      background: 'rgba(26,35,50,0.7)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem',
      padding: '1.5rem', marginBottom: '1.5rem'
    }}>
      <h3 style={{color:'#F3F4F6', fontSize:'1.25rem', marginTop:0, marginBottom:'1rem'}}>🧠 Explainable AI (XAI) Reasoning</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'1rem'}}>
        {renderSection("Demographics (Gender)", classification.gender)}
        {renderSection("Vocal Tract (Age)", classification.age)}
        {renderSection("Acoustic Health Pattern", classification.speech_pattern)}
      </div>
    </div>
  );
};

export default ExplainabilityCard;
