import React, { useState, useEffect } from 'react';

const DictionaryEditor = () => {
  const [dictionary, setDictionary] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [wrongWord, setWrongWord] = useState('');
  const [correctWord, setCorrectWord] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchDictionary = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const response = await fetch('http://localhost:8008/api/dictionary');
      const data = await response.json();
      setDictionary(data);
      setFetchError(false);
    } catch (err) {
      console.error('Failed to fetch dictionary', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDictionary();
  }, []);

  const handleSave = async (updatedDict) => {
    try {
      setStatusMsg('Saving...');
      const response = await fetch('http://localhost:8008/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDict),
      });
      if (response.ok) {
        setDictionary(updatedDict);
        setStatusMsg('Saved successfully!');
        setTimeout(() => setStatusMsg(''), 2000);
      } else {
        setStatusMsg('Failed to save.');
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Error saving.');
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!wrongWord.trim()) return;
    const newDict = { ...dictionary, [wrongWord.trim()]: correctWord.trim() };
    handleSave(newDict);
    setWrongWord('');
    setCorrectWord('');
  };

  const handleDelete = (key) => {
    const newDict = { ...dictionary };
    delete newDict[key];
    handleSave(newDict);
  };

  if (loading) {
    return <div style={{ color: '#9CA3AF', padding: '1rem', fontSize: '0.875rem' }}>Loading Dictionary…</div>;
  }

  if (fetchError) {
    return (
      <div style={{ background: 'rgba(26,35,50,0.8)', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '1.25rem' }}>📚</span>
        <div>
          <div style={{ fontWeight: 600, color: '#9CA3AF', fontSize: '0.9rem' }}>Kannada Correction Dictionary</div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Unavailable while backend is offline.</div>
        </div>
        <button onClick={fetchDictionary} style={{ marginLeft: 'auto', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(26,35,50,0.8)',
      padding: '1.5rem',
      borderRadius: '0.75rem',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#F3F4F6'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Kannada Correction Dictionary</h2>
      <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '1.5rem' }}>
        Add rules to correct common STT errors. Leave "Correct Word" empty to remove the word entirely (e.g. Hindi intrusions).
      </p>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Original (Wrong) Word"
          value={wrongWord}
          onChange={(e) => setWrongWord(e.target.value)}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: '0.5rem',
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#F3F4F6', outline: 'none'
          }}
          required
        />
        <input
          type="text"
          placeholder="Corrected Word (leave blank to delete)"
          value={correctWord}
          onChange={(e) => setCorrectWord(e.target.value)}
          style={{
            flex: 1, padding: '0.75rem', borderRadius: '0.5rem',
            background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#F3F4F6', outline: 'none'
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
            background: '#3B82F6', color: 'white', fontWeight: 600,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(59,130,246,0.3)'
          }}
        >
          Add Rule
        </button>
      </form>

      {statusMsg && <div style={{ marginBottom: '1rem', color: '#10B981', fontSize: '0.875rem' }}>{statusMsg}</div>}

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem', color: '#9CA3AF' }}>Original Word</th>
              <th style={{ padding: '0.75rem 1rem', color: '#9CA3AF' }}>Replacement</th>
              <th style={{ padding: '0.75rem 1rem', color: '#9CA3AF', width: '80px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(dictionary).map(([key, value]) => (
              <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.75rem 1rem', color: '#F87171' }}>{key}</td>
                <td style={{ padding: '0.75rem 1rem', color: '#34D399' }}>{value || <em style={{color:'#6B7280'}}>(Removed)</em>}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <button
                    onClick={() => handleDelete(key)}
                    style={{
                      background: 'transparent', border: 'none', color: '#EF4444',
                      cursor: 'pointer', fontSize: '0.875rem'
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {Object.keys(dictionary).length === 0 && (
              <tr>
                <td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: '#9CA3AF' }}>
                  No rules defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DictionaryEditor;
