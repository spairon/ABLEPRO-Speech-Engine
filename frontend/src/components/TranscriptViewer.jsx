import React, { useState, useMemo } from 'react';

// ─── Speaker colour palette ───────────────────────────────────────────────
const SPEAKER_COLORS = [
  { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.5)',  text: '#60A5FA' },
  { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.5)', text: '#34D399' },
  { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.5)', text: '#FCD34D' },
  { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.5)',  text: '#FCA5A5' },
  { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.5)', text: '#C4B5FD' },
];

function getSpeakerColor(speaker) {
  const n = parseInt((speaker || '').replace(/\D/g, '') || '1', 10);
  return SPEAKER_COLORS[(n - 1) % SPEAKER_COLORS.length];
}

// ─── Format seconds as mm:ss.s ────────────────────────────────────────────
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

// ─── Highlight changed words between raw and corrected ───────────────────
function diffWords(raw, corrected) {
  if (!raw || !corrected) return [{ text: corrected || raw || '', changed: false }];
  const rawTokens  = raw.split(/\s+/);
  const corrTokens = corrected.split(/\s+/);

  const maxLen = Math.max(rawTokens.length, corrTokens.length);
  const parts  = [];
  for (let i = 0; i < maxLen; i++) {
    const r = rawTokens[i]  || '';
    const c = corrTokens[i] || '';
    parts.push({ text: c, changed: r !== c });
  }
  return parts;
}

// ─── Individual segment card ──────────────────────────────────────────────
function SegmentCard({ seg, mode }) {
  const col     = getSpeakerColor(seg.speaker);
  const display = mode === 'raw' ? seg.rawText : seg.correctedText || seg.rawText;
  const diffParts = (mode === 'corrected' || mode === 'side')
    ? diffWords(seg.rawText, seg.correctedText)
    : null;

  return (
    <div style={{
      display: 'flex',
      gap: '1rem',
      padding: '0.875rem 1rem',
      borderRadius: '0.625rem',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.06)',
      transition: 'background 0.2s',
    }}>
      {/* Timestamp + Speaker badge */}
      <div style={{
        minWidth: '7.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '0.5rem',
        padding: '0.5rem 0.75rem',
        border: `1px solid ${col.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.65rem', color: '#9CA3AF', letterSpacing: '0.02em' }}>
          {fmt(seg.start)} – {fmt(seg.end)}
        </span>
        <span style={{ color: col.text, fontWeight: 700, fontSize: '0.78rem' }}>
          {seg.speaker || 'SPEAKER_01'}
        </span>
      </div>

      {/* Text content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {mode === 'side' ? (
          <>
            {/* Side-by-side: raw on top, corrected below */}
            <div style={{ fontSize: '0.8rem', color: '#6B7280', fontStyle: 'italic', lineHeight: 1.6 }}>
              {seg.rawText || <span style={{ color: '#4B5563' }}>—</span>}
            </div>
            <div style={{
              width: '100%',
              height: '1px',
              background: 'rgba(255,255,255,0.06)',
            }} />
            <div style={{ lineHeight: 1.7, fontSize: '1rem', color: '#F3F4F6' }}>
              {diffParts?.map((p, i) => (
                <span key={i} style={{
                  color: p.changed ? '#FCD34D' : '#F3F4F6',
                  background: p.changed ? 'rgba(245,158,11,0.12)' : 'transparent',
                  borderRadius: '2px',
                  padding: p.changed ? '0 2px' : '0',
                }}>
                  {p.text}{' '}
                </span>
              ))}
            </div>
          </>
        ) : mode === 'corrected' ? (
          <div style={{ lineHeight: 1.7, fontSize: '1rem', color: '#F3F4F6' }}>
            {diffParts?.map((p, i) => (
              <span key={i} style={{
                color: p.changed ? '#FCD34D' : '#F3F4F6',
                background: p.changed ? 'rgba(245,158,11,0.12)' : 'transparent',
                borderRadius: '2px',
                padding: p.changed ? '0 2px' : '0',
              }}>
                {p.text}{' '}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ lineHeight: 1.7, fontSize: '1rem', color: '#9CA3AF' }}>
            {display}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Stage Badge ─────────────────────────────────────────────────
function StageBadge({ label, value, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '999px',
      padding: '0.25rem 0.75rem',
      border: `1px solid ${color}40`,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{label}:</span>
      <span style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─── Main TranscriptViewer component ─────────────────────────────────────
const TranscriptViewer = ({ rawTranscription = [], correctedTranscription = [], pipelineInfo = {} }) => {
  const [activeTab, setActiveTab] = useState('corrected');

  // Merge raw + corrected into unified segments
  const segments = useMemo(() => {
    const maxLen = Math.max(rawTranscription.length, correctedTranscription.length);
    const merged = [];
    for (let i = 0; i < maxLen; i++) {
      const r = rawTranscription[i]     || {};
      const c = correctedTranscription[i] || {};
      merged.push({
        start:         c.start         ?? r.start         ?? 0,
        end:           c.end           ?? r.end           ?? 0,
        speaker:       c.speaker       || r.speaker       || 'SPEAKER_01',
        rawText:       r.text          || '',
        correctedText: c.text          || '',
      });
    }
    return merged;
  }, [rawTranscription, correctedTranscription]);

  // Count how many segments were actually changed by the correction pipeline
  const changedCount = useMemo(
    () => segments.filter(s => s.rawText !== s.correctedText).length,
    [segments]
  );

  const tabs = [
    { id: 'corrected', label: '✅ Corrected',  title: 'Post-pipeline corrected Kannada transcript' },
    { id: 'raw',       label: '🎙️ Raw STT',    title: 'Direct output from speech-to-text model' },
    { id: 'side',      label: '⇄ Compare',    title: 'Side-by-side raw vs corrected' },
  ];

  const tabStyle = (id) => ({
    padding: '0.45rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: activeTab === id ? 700 : 400,
    transition: 'all 0.2s',
    background: activeTab === id
      ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.3))'
      : 'rgba(255,255,255,0.04)',
    color: activeTab === id ? '#E0E7FF' : '#6B7280',
    boxShadow: activeTab === id ? '0 0 0 1px rgba(99,102,241,0.5)' : 'none',
  });

  return (
    <div style={{
      background: 'rgba(26,35,50,0.7)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '1rem',
      boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
      padding: '1.5rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60A5FA', margin: 0 }}>
            🎙️ Kannada Transcription
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
            {segments.length} segment(s) · {changedCount} correction(s) applied
          </p>
        </div>

        {/* Pipeline badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <StageBadge
            label="Engine"
            value={pipelineInfo.stt_engine || 'whisper'}
            color={pipelineInfo.fallback_reason ? "#F59E0B" : "#60A5FA"}
          />
          {pipelineInfo.fallback_reason && (
            <StageBadge
              label="Fallback"
              value={pipelineInfo.fallback_reason}
              color="#EF4444"
            />
          )}
          <StageBadge
            label="Dict"
            value={`${pipelineInfo.dictionary_entries || 0} entries`}
            color="#34D399"
          />
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            title={tab.title}
            style={tabStyle(tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}

        {/* Legend for corrected / compare views */}
        {(activeTab === 'corrected' || activeTab === 'side') && changedCount > 0 && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.7rem',
            color: '#9CA3AF',
          }}>
            <span style={{
              display: 'inline-block',
              width: '10px', height: '10px',
              background: 'rgba(245,158,11,0.4)',
              borderRadius: '2px',
            }} />
            corrected word
          </div>
        )}
      </div>

      {/* Segment list */}
      <div style={{
        maxHeight: '26rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        paddingRight: '0.25rem',
      }}>
        {segments.length > 0 ? (
          segments.map((seg, idx) => (
            <SegmentCard key={idx} seg={seg} mode={activeTab} />
          ))
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            color: '#4B5563',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '2rem' }}>🎙️</span>
            <span>No transcription data available.</span>
          </div>
        )}
      </div>

      {/* Footer: active tab description */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.7rem',
        color: '#4B5563',
        textAlign: 'right',
      }}>
        {tabs.find(t => t.id === activeTab)?.title}
      </div>
    </div>
  );
};

export default TranscriptViewer;
