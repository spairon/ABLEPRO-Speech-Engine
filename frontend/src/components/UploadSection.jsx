import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
// ─── Stage definitions ────────────────────────────────────────────────────────
const STAGES = [
  { id: 'diarization',    icon: '🔊', label: 'Speaker Diarization',    sub: 'Identifying unique speakers...' },
  { id: 'features',       icon: '📊', label: 'Acoustic Features',       sub: 'Extracting pitch, jitter, MFCC...' },
  { id: 'transcription',  icon: '📝', label: 'Kannada Transcription',   sub: 'Running Sarvam AI STT...' },
  { id: 'classification', icon: '🧠', label: 'ML Classification',       sub: 'Predicting gender, age, pattern...' },
];

// ─── PipelineProgress component ───────────────────────────────────────────────
const PipelineProgress = ({ stageStatuses, fileName }) => {
  const total    = STAGES.length;
  const done     = STAGES.filter(s => stageStatuses[s.id] === 'done').length;
  const progress = Math.round((done / total) * 100);

  return (
    <div style={{
      width: '100%', maxWidth: '520px',
      background: 'rgba(15,23,42,0.8)',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: '1.25rem',
      padding: '2rem',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg,#6366f1,#10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(99,102,241,0.5)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚙️</span>
        </div>
        <div>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem' }}>
            Processing Audio
          </div>
          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 2 }}>
            {fileName}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, background: 'rgba(255,255,255,0.07)',
        borderRadius: 99, marginBottom: '1.75rem', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg,#6366f1,#10b981)',
          borderRadius: 99,
          transition: 'width 0.5s ease',
          boxShadow: '0 0 8px rgba(99,102,241,0.6)',
        }} />
      </div>

      {/* Stage rows — diarization + features run in parallel, so show them side-by-side */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Row 1: parallel pair */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
          {STAGES.slice(0, 2).map(stage => (
            <StageRow key={stage.id} stage={stage} status={stageStatuses[stage.id] || 'pending'} compact />
          ))}
        </div>
        {/* Row 2 & 3: sequential */}
        {STAGES.slice(2).map(stage => (
          <StageRow key={stage.id} stage={stage} status={stageStatuses[stage.id] || 'pending'} />
        ))}
      </div>

      {/* Bottom label */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#475569', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
        {done < total ? `${done} / ${total} stages complete` : '✅ All stages complete — loading results...'}
      </div>
    </div>
  );
};

const StageRow = ({ stage, status, compact }) => {
  const colors = {
    pending: { dot: '#374151', text: '#4b5563',  bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)' },
    running: { dot: '#6366f1', text: '#a5b4fc',  bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.3)'  },
    done:    { dot: '#10b981', text: '#6ee7b7',  bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.3)'  },
  };
  const c = colors[status];
  const isRunning = status === 'running';
  const isDone    = status === 'done';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem',
      padding: compact ? '0.55rem 0.75rem' : '0.7rem 1rem',
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '0.75rem', transition: 'all 0.3s ease',
    }}>
      {/* Status dot / spinner */}
      <div style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isDone ? (
          <span style={{ fontSize: '1rem' }}>✅</span>
        ) : isRunning ? (
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${c.dot}`,
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
        ) : (
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot }} />
        )}
      </div>

      {/* Icon + text */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: compact ? '0.75rem' : '0.8rem' }}>{stage.icon}</span>
          <span style={{ color: c.text, fontWeight: 600, fontSize: compact ? '0.72rem' : '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stage.label}
          </span>
        </div>
        {!compact && (
          <div style={{ color: '#475569', fontSize: '0.65rem', marginTop: 1 }}>
            {isRunning ? stage.sub : isDone ? 'Complete' : 'Waiting...'}
          </div>
        )}
      </div>
    </div>
  );
};


// ─── Main UploadSection ───────────────────────────────────────────────────────
const UploadSection = ({ onUploadSSE, isLoading, error }) => {
  const [dragActive, setDragActive]     = useState(false);
  const [fileName, setFileName]         = useState('');
  const [stageStatuses, setStageStatuses] = useState({});

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const startUpload = useCallback((file) => {
    if (!file.name.toLowerCase().endsWith('.wav')) {
      alert('Please upload a .wav file');
      return;
    }
    setFileName(file.name);
    setStageStatuses({});
    onUploadSSE(file, setStageStatuses);
  }, [onUploadSSE]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) startUpload(e.dataTransfer.files[0]);
  }, [startUpload]);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files?.[0]) startUpload(e.target.files[0]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 1rem 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: 640 }}>
        <p style={{ color: '#6B7280', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          Powered by Sarvam AI · Faster-Whisper · Librosa
        </p>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          Kannada Speech Diagnostics
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Upload a <span style={{ color: '#6366f1' }}>.wav audio file</span> to run full speaker diarization,
          Kannada transcription, acoustic feature extraction, and ML classification.
        </p>
      </div>

      {/* Upload card OR progress stepper */}
      {isLoading ? (
        <PipelineProgress stageStatuses={stageStatuses} fileName={fileName} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '520px' }}>
          <div
            style={{
              background: dragActive ? 'rgba(99,102,241,0.08)' : 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(12px)',
              border: `2px dashed ${dragActive ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '1.25rem',
              boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
              transform: dragActive ? 'scale(1.02)' : 'scale(1)',
              transition: 'all 0.3s ease',
              padding: '3rem',
              width: '100%',
              textAlign: 'center',
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file" id="file-upload"
              style={{ display: 'none' }}
              accept=".wav"
              onChange={handleChange}
            />
            <label htmlFor="file-upload" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', cursor: 'pointer' }}>
              <div style={{ padding: '1.5rem', background: 'rgba(99,102,241,0.1)', borderRadius: '50%', boxShadow: '0 0 30px rgba(99,102,241,0.2)' }}>
                <UploadCloud style={{ width: '4rem', height: '4rem', color: dragActive ? '#6366f1' : '#818cf8' }} />
              </div>
              <div style={{ fontSize: '1.1rem' }}>
                <span style={{ color: '#6366f1', fontWeight: 700 }}>Click to upload</span>
                <span style={{ color: '#9CA3AF' }}> or drag & drop</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                WAV Format Only
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '2rem', padding: '1rem 1.5rem',
          background: 'rgba(127,29,29,0.4)', color: '#FCA5A5',
          borderRadius: '0.75rem', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          maxWidth: '520px', width: '100%',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default UploadSection;
