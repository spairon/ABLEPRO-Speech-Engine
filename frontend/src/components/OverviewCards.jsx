import React from 'react';

const card = {
  background: 'rgba(26,35,50,0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '1rem',
  boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
  padding: '1.5rem',
};

const statCard = (color) => ({
  background: `rgba(${color},0.08)`,
  border: `1px solid rgba(${color},0.2)`,
  borderRadius: '0.75rem',
  padding: '1.25rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

const CARD_CONFIGS = [
  { title: 'Audio Duration', key: 'audioDuration', icon: '⏱️', rgb: '139,92,246', suffix: ' sec' },
  { title: 'Unique Speakers', key: 'speakerCount', icon: '👥', rgb: '59,130,246' },
  { title: 'Dict Corrections', key: 'correctionsCount', icon: '✨', rgb: '16,185,129' },
  { title: 'STT Engine', key: 'sttEngine', icon: '⚙️', rgb: '245,158,11' },
];

const OverviewCards = ({ data }) => {
  const engine = data?.pipelineInfo?.stt_engine || '--';
  const engineDisplay = engine.includes('Sarvam') ? 'Sarvam API' : engine.includes('Whisper') ? 'Whisper (GPU)' : engine;
  
  const values = {
    speakerCount: data?.speakerCount ?? '--',
    audioDuration: data?.audioDuration ?? '--',
    correctionsCount: data?.pipelineInfo?.corrections_count ?? '--',
    sttEngine: engineDisplay,
  };

  const renderSpeakerStats = () => {
    if (!data?.speakerStats) return null;
    return (
      <div style={{marginTop:'0.75rem', display:'flex', flexDirection:'column', gap:'0.25rem', fontSize:'0.75rem', color:'#9CA3AF'}}>
        {Object.entries(data.speakerStats).map(([spk, stats]) => (
          <div key={spk} style={{display:'flex', justifyContent:'space-between'}}>
            <span>{spk} ({stats.confidence}% conf)</span>
            <span>{stats.duration}s</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem'}}>
      {CARD_CONFIGS.map((cfg, i) => (
        <div key={i} style={{...card, ...statCard(cfg.rgb)}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <span style={{fontSize:'0.75rem', color:'#9CA3AF', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em'}}>{cfg.title}</span>
            <span style={{fontSize:'1.5rem'}}>{cfg.icon}</span>
          </div>
          <div style={{fontSize:'1.5rem', fontWeight:700, color:'#F3F4F6'}}>
            {values[cfg.key]}{cfg.suffix || ''}
          </div>
          {cfg.key === 'speakerCount' && renderSpeakerStats()}
        </div>
      ))}
    </div>
  );
};

export default OverviewCards;
