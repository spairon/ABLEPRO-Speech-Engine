import React, { useState } from 'react';
import { UploadCloud, CheckCircle, Activity, BarChart2 } from 'lucide-react';

const ComparisonDashboard = () => {
  const [convFile, setConvFile] = useState(null);
  const [wordFile, setWordFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async () => {
    if (!convFile || !wordFile) {
      setError("Please select both Conversation and Word Repetition files.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('conv_file', convFile);
    formData.append('word_file', wordFile);
    
    try {
      const response = await fetch('http://127.0.0.1:8008/api/compare', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Comparison failed. Check backend logs.");
      }
      
      const data = await response.json();
      setResult(data.comparison);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl max-w-4xl w-full mx-auto">
        <h2 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center gap-3">
          <Activity className="text-indigo-500 w-8 h-8" />
          Diagnostic Comparison Results
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <ScoreCard title="Fluency Score" score={result.fluency} color="text-emerald-400" />
          <ScoreCard title="Pronunciation" score={result.pronunciation} color="text-blue-400" />
          <ScoreCard title="Consistency" score={result.consistency} color="text-purple-400" />
          <ScoreCard title="Overall Health" score={result.overall_health} color="text-indigo-400" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-xl font-semibold text-gray-200 mb-4 border-b border-gray-600 pb-2">Conversation Task</h3>
            <ul className="space-y-3 text-gray-300">
              <li><strong className="text-gray-400">Duration:</strong> {result.analysis.conversation.duration}s</li>
              <li><strong className="text-gray-400">Speaking Rate:</strong> {result.analysis.conversation.speaking_rate} words/sec</li>
              <li><strong className="text-gray-400">Pause Ratio:</strong> {(result.analysis.conversation.pause_ratio * 100).toFixed(1)}%</li>
              <li><strong className="text-gray-400">Pattern:</strong> {result.analysis.conversation.pattern}</li>
            </ul>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-xl font-semibold text-gray-200 mb-4 border-b border-gray-600 pb-2">Word Repetition Task</h3>
            <ul className="space-y-3 text-gray-300">
              <li><strong className="text-gray-400">Duration:</strong> {result.analysis.word_repetition.duration}s</li>
              <li><strong className="text-gray-400">Jitter:</strong> {result.analysis.word_repetition.jitter}</li>
              <li><strong className="text-gray-400">Shimmer:</strong> {result.analysis.word_repetition.shimmer}</li>
              <li><strong className="text-gray-400">Pattern:</strong> {result.analysis.word_repetition.pattern}</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <button 
            onClick={() => setResult(null)} 
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            New Comparison
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl max-w-2xl w-full mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Compare Tasks (C vs W)</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-gray-400 text-sm font-medium mb-2">1. Upload Conversation Audio (C)</label>
          <input 
            type="file" 
            accept=".wav"
            onChange={(e) => setConvFile(e.target.files[0])}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-900 file:text-indigo-300 hover:file:bg-indigo-800"
          />
        </div>
        
        <div>
          <label className="block text-gray-400 text-sm font-medium mb-2">2. Upload Word Repetition Audio (W)</label>
          <input 
            type="file" 
            accept=".wav"
            onChange={(e) => setWordFile(e.target.files[0])}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-900 file:text-indigo-300 hover:file:bg-indigo-800"
          />
        </div>
        
        {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">{error}</div>}
        
        <button 
          onClick={handleCompare}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-900/20"
        >
          {loading ? 'Analyzing...' : 'Compare Files'}
        </button>
      </div>
    </div>
  );
};

const ScoreCard = ({ title, score, color }) => (
  <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center flex flex-col items-center justify-center shadow-inner">
    <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">{title}</h3>
    <div className={`text-4xl font-black ${color}`}>
      {score}<span className="text-lg text-gray-500 ml-1">/100</span>
    </div>
  </div>
);

export default ComparisonDashboard;
