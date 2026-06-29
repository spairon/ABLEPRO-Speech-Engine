import React, { useState, useEffect } from 'react';

const formatTimestamp = (isoString) => {
  if (!isoString) return 'Never';
  return new Date(isoString).toLocaleString();
};

const ApiStatusCard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8008/api/system/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(26,35,50,0.6)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#6B7280' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B7280', animation: 'pulse 1.5s ease-in-out infinite' }} />
      Connecting to backend…
    </div>
  );
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(245,158,11,0.08)', borderRadius: '0.5rem', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '1.5rem' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
      <span style={{ fontSize: '0.8rem', color: '#FCD34D', fontWeight: 500 }}>Backend Offline</span>
      <span style={{ fontSize: '0.75rem', color: '#92400E', marginLeft: 'auto' }}>Start the FastAPI server on port 8008 to enable analysis</span>
      <button onClick={fetchStatus} style={{ padding: '0.25rem 0.6rem', borderRadius: '0.35rem', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#FCD34D', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
    </div>
  );
  if (!status) return null;

  return (
    <div style={{
      background: 'rgba(26,35,50,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '0.75rem',
      padding: '1.25rem',
      color: '#F3F4F6',
      marginBottom: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
        System & API Status
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Local Whisper Card */}
        <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', borderLeft: '3px solid #3B82F6' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#9CA3AF' }}>Local Whisper</h4>
          <div style={{ fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Running Locally:</span> <strong>{status?.whisper?.local ? 'Yes' : 'No'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Model:</span> <strong>{status?.whisper?.model || 'N/A'}</strong>
            </div>
          </div>
        </div>

      </div>

      {/* Settings Panel: Current Pipeline */}
      <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', border: '1px dashed rgba(255,255,255,0.2)' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#9CA3AF' }}>Current Pipeline Flow</h4>
        <div style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', color: '#E5E7EB' }}>
          <span>Audio</span>
          <span style={{ color: '#6B7280' }}>→</span>
          <span style={{ padding: '0.1rem 0.4rem', background: '#3B82F6', borderRadius: '0.25rem', fontSize: '0.75rem' }}>{status?.pipeline?.transcription?.toUpperCase() || 'UNKNOWN'}</span>
          <span style={{ color: '#6B7280' }}>→</span>
          <span style={{ padding: '0.1rem 0.4rem', background: status?.pipeline?.correction === 'skipped' ? '#6B7280' : '#10B981', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
            {status?.pipeline?.correction === 'skipped' ? 'NO CORRECTION' : (status?.pipeline?.correction?.toUpperCase() || 'UNKNOWN') + ' CORRECTION'}
          </span>
          <span style={{ color: '#6B7280' }}>→</span>
          <span>Dashboard</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.5rem' }}>
          Speaker Analysis Provider: <strong>{status?.pipeline?.speaker_analysis || 'N/A'}</strong>
        </div>
      </div>
    </div>
  );
};

export default ApiStatusCard;
