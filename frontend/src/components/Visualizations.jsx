import React from 'react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as RechartsTooltip } from 'recharts';
import TranscriptViewer from './TranscriptViewer';

const card = {
  background: 'rgba(26,35,50,0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '1rem',
  boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
  padding: '1.5rem',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{background:'rgba(26,35,50,0.95)',border:'1px solid rgba(255,255,255,0.1)',padding:'0.75rem',borderRadius:'0.5rem'}}>
        <p style={{fontWeight:600,marginBottom:'0.25rem'}}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{color: entry.color, fontSize:'0.875rem'}}>{entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

const Visualizations = ({ data }) => {
  // Safe accessors
  const acousticFeatures      = data?.acousticFeatures || {};
  const rawTranscription      = data?.rawTranscription || [];
  const correctedTranscription = data?.correctedTranscription || [];
  const pipelineInfo          = data?.pipelineInfo || {};
  const classification        = data?.classification || {};
  const genderProb = classification?.gender?.probabilities || { Male: 50, Female: 50 };
  const patternProb = classification?.speech_pattern?.probabilities || { Typical: 50, Atypical: 50 };

  const mfccData = (acousticFeatures.mfcc_1_13 || []).map((val, idx) => ({
    subject: `M${idx + 1}`,
    A: Math.round(val * 10) / 10,
    fullMark: 200,
  }));

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>

      {/* Transcription Viewer — tabbed Raw / Corrected / Side-by-Side (Ignored in PDF) */}
      <div data-html2canvas-ignore="true">
        <TranscriptViewer
          rawTranscription={rawTranscription}
          correctedTranscription={correctedTranscription}
          pipelineInfo={pipelineInfo}
        />
      </div>

      {/* Charts row */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>

        {/* MFCC Radar */}
        <div style={card}>
          <h3 style={{fontSize:'1.1rem', fontWeight:600, marginBottom:'1rem', color:'#60A5FA'}}>📊 MFCC Feature Profile</h3>
          <div style={{height:'280px'}}>
            {mfccData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={mfccData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[-200, 200]} tick={false} axisLine={false} />
                  <Radar name="MFCC" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} />
                  <RechartsTooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#6B7280'}}>No MFCC data</div>
            )}
          </div>
        </div>

        {/* Probabilities */}
        <div style={card}>
          <h3 style={{fontSize:'1.1rem', fontWeight:600, marginBottom:'1.5rem', color:'#60A5FA'}}>🎯 Diagnostic Probabilities</h3>

          <div style={{marginBottom:'1.5rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5rem', fontSize:'0.875rem'}}>
              <span style={{color:'#9CA3AF'}}>Gender — Male vs Female</span>
              <span style={{fontWeight:700}}>{genderProb.Male}% / {genderProb.Female}%</span>
            </div>
            <div style={{height:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'9999px', overflow:'hidden', display:'flex'}}>
              <div style={{width:`${genderProb.Male}%`, background:'#3B82F6', transition:'width 1s ease'}} />
              <div style={{width:`${genderProb.Female}%`, background:'#EC4899', transition:'width 1s ease'}} />
            </div>
          </div>

          <div style={{marginBottom:'1.5rem'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5rem', fontSize:'0.875rem'}}>
              <span style={{color:'#9CA3AF'}}>Speech — Typical vs Atypical</span>
              <span style={{fontWeight:700}}>{patternProb.Typical}% / {patternProb.Atypical}%</span>
            </div>
            <div style={{height:'12px', background:'rgba(255,255,255,0.05)', borderRadius:'9999px', overflow:'hidden', display:'flex'}}>
              <div style={{width:`${patternProb.Typical}%`, background:'#10B981', transition:'width 1s ease'}} />
              <div style={{width:`${patternProb.Atypical}%`, background:'#F43F5E', transition:'width 1s ease'}} />
            </div>
          </div>

          {/* Stat boxes */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginTop:'1rem'}}>
            {[
              {label:'Pitch Mean', value:`${acousticFeatures.pitch_mean ?? '--'} Hz`, color:'#60A5FA'},
              {label:'Energy RMS', value: acousticFeatures.rms_energy ?? '--', color:'#34D399'},
              {label:'Speaking Rate', value: acousticFeatures.speaking_rate ?? '--', color:'#A78BFA'},
              {label:'Jitter (approx)', value: acousticFeatures.jitter ?? '--', color:'#FBBF24'},
            ].map((item, i) => (
              <div key={i} style={{background:'rgba(0,0,0,0.3)', borderRadius:'0.5rem', padding:'0.875rem', textAlign:'center', border:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{fontSize:'0.7rem', color:'#9CA3AF', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em'}}>{item.label}</div>
                <div style={{fontSize:'1.1rem', fontFamily:'monospace', color: item.color, fontWeight:700}}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explainability Row */}
      <div style={{...card, marginTop: '1.5rem'}}>
        <h3 style={{fontSize:'1.1rem', fontWeight:600, marginBottom:'1rem', color:'#60A5FA'}}>💡 AI Explainability</h3>
        
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'1.5rem'}}>
          {['gender', 'age', 'speech_pattern'].map(key => {
            const item = classification[key];
            if (!item) return null;
            return (
              <div key={key} style={{background:'rgba(0,0,0,0.2)', padding:'1rem', borderRadius:'0.5rem', border:'1px solid rgba(255,255,255,0.05)'}}>
                <div style={{fontWeight:'bold', textTransform:'capitalize', marginBottom:'0.5rem', color:'#F3F4F6'}}>{key.replace('_', ' ')}: {item.prediction}</div>
                <div style={{fontSize:'0.85rem', color:'#9CA3AF', marginBottom:'1rem'}}>{item.reasoning}</div>
                
                {item.top_features && item.top_features.length > 0 && (
                  <div>
                    <div style={{fontSize:'0.75rem', color:'#6B7280', textTransform:'uppercase', marginBottom:'0.5rem'}}>Top Contributing Features:</div>
                    {item.top_features.map((f, i) => (
                      <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'#D1D5DB', marginBottom:'0.25rem'}}>
                        <span>{f.name}</span>
                        <span>{f.importance}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Visualizations;
