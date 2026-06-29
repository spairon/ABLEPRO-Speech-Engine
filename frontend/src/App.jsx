import React, { useState } from 'react';
import UploadSection from './components/UploadSection';
import Dashboard from './components/Dashboard';
import ApiStatusCard from './components/ApiStatusCard';
import DictionaryEditor from './components/DictionaryEditor';
import ComparisonDashboard from './components/ComparisonDashboard';
import QuotaBattery from './components/QuotaBattery';

function App() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading]           = useState(false);
  const [error, setError]                   = useState(null);
  const [mode, setMode]                     = useState('single');

  /**
   * Upload via SSE streaming endpoint (/api/analyze-stream).
   * Calls setStageStatuses(fn) from UploadSection to update the progress UI
   * as each SSE event arrives.
   */
  const handleUploadSSE = async (file, setStageStatuses) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:8008/api/analyze-stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let detail = 'Analysis failed';
        try { const err = await response.json(); detail = err.detail || detail; } catch (_) {}
        throw new Error(detail);
      }

      // Parse SSE stream
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by double newlines
        const frames = buffer.split('\n\n');
        buffer = frames.pop(); // keep the last incomplete frame

        for (const frame of frames) {
          if (!frame.trim()) continue;

          // Extract event name and data
          const eventLine = frame.split('\n').find(l => l.startsWith('event:'));
          const dataLine  = frame.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;

          const eventName = eventLine ? eventLine.replace('event:', '').trim() : 'message';
          const payload   = JSON.parse(dataLine.replace('data:', '').trim());

          console.log(`[SSE] ${eventName}`, payload);

          if (eventName === 'stage') {
            // Update the stage status map
            setStageStatuses(prev => ({
              ...prev,
              [payload.stage]: payload.status,
            }));
          } else if (eventName === 'result') {
            // Pipeline finished — show dashboard
            console.log('✅ Backend result:', payload);
            setAnalysisResult({ ...payload, filename: file.name });
            setIsLoading(false);
            return;
          } else if (eventName === 'error') {
            throw new Error(payload.detail || payload.message || 'Server error during processing');
          }
        }
      }
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.message || 'Something went wrong. Make sure the FastAPI backend is running on http://localhost:8008');
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F19', color: '#F3F4F6', padding: '1.5rem', fontFamily: "'Inter', sans-serif" }}>
      <QuotaBattery />
      <header style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.02em', textShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
            ABLEPRO <span style={{ color: '#6B7280', fontWeight: 300 }}>Speech Engine</span>
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(31, 41, 55, 0.5)', padding: '0.25rem', borderRadius: '9999px', border: '1px solid #374151' }}>
          <button 
            onClick={() => setMode('single')} 
            style={{ 
              padding: '0.5rem 1.5rem', borderRadius: '9999px', fontWeight: 600, fontSize: '0.875rem', 
              background: mode === 'single' ? '#6366f1' : 'transparent',
              color: mode === 'single' ? 'white' : '#9ca3af',
              transition: 'all 0.2s', border: 'none', cursor: 'pointer'
            }}>
            Single Analysis
          </button>
          <button 
            onClick={() => setMode('compare')} 
            style={{ 
              padding: '0.5rem 1.5rem', borderRadius: '9999px', fontWeight: 600, fontSize: '0.875rem', 
              background: mode === 'compare' ? '#6366f1' : 'transparent',
              color: mode === 'compare' ? 'white' : '#9ca3af',
              transition: 'all 0.2s', border: 'none', cursor: 'pointer'
            }}>
            C vs W Comparison
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <ApiStatusCard />
        
        {mode === 'single' ? (
          <>
            {!analysisResult ? (
              <UploadSection onUploadSSE={handleUploadSSE} isLoading={isLoading} error={error} />
            ) : (
              <ErrorBoundary onReset={() => setAnalysisResult(null)}>
                <Dashboard data={analysisResult} onReset={() => setAnalysisResult(null)} />
              </ErrorBoundary>
            )}
            <div style={{ marginTop: '2rem' }}>
              <DictionaryEditor />
            </div>
          </>
        ) : (
          <ComparisonDashboard />
        )}
      </main>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Dashboard render error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: 'rgba(127,29,29,0.4)', color: '#FCA5A5', borderRadius: '1rem', border: '1px solid rgba(239,68,68,0.5)', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>⚠️ Dashboard Rendering Error</h2>
          <p style={{ marginBottom: '1rem' }}>The dashboard crashed while displaying the data. See error below:</p>
          <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false }); this.props.onReset?.(); }}
            style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#EF4444', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Reset & Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App;
