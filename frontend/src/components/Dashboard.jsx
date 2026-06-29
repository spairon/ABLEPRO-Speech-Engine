import React, { useRef, useState } from 'react';
import OverviewCards from './OverviewCards';
import Visualizations from './Visualizations';
import ReportGenerator from './ReportGenerator';
import PipelineArchitecture from './PipelineArchitecture';
import FeatureEngineering from './FeatureEngineering';
import ExplainabilityCard from './ExplainabilityCard';
import ErrorAnalysis from './ErrorAnalysis';
import PerformanceProfiler from './PerformanceProfiler';
import ExecutiveSummary from './ExecutiveSummary';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Dashboard = ({ data, onReset }) => {
  const reportRef = useRef();
  const [demoMode, setDemoMode] = useState(false);

  const handleDownloadPDF = async () => {
    const element = reportRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#0B0F19' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('ABLEPRO_Speech_Diagnostic_Report.pdf');
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('PDF generation failed. Please try again.');
    }
  };

  return (
    <div ref={reportRef} style={{display:'flex', flexDirection:'column', gap:'1.5rem'}}>
      {/* Header bar */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem'}}>
        <div>
          <h2 style={{fontSize:'1.75rem', fontWeight:700, color:'#F3F4F6', margin: 0}}>Diagnostic Report</h2>
          {data.filename && <p style={{fontSize: '0.9rem', color: '#9CA3AF', margin: '0.25rem 0 0 0'}}>File: {data.filename}</p>}
        </div>
        <div style={{display:'flex', gap:'0.75rem'}}>
          <label style={{
            display:'flex', alignItems:'center', gap:'0.5rem',
            padding:'0.5rem 1rem', borderRadius:'0.5rem',
            background: demoMode ? 'rgba(16,185,129,0.2)' : 'rgba(26,35,50,0.8)', 
            color: demoMode ? '#10B981' : '#F3F4F6',
            border: demoMode ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.08)',
            cursor:'pointer', fontSize:'0.875rem', fontWeight:600,
          }}>
            <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} style={{cursor:'pointer'}}/>
            Presentation Mode (Demo)
          </label>
          <button
            onClick={onReset}
            style={{
              display:'flex', alignItems:'center', gap:'0.5rem',
              padding:'0.5rem 1rem', borderRadius:'0.5rem',
              background:'rgba(26,35,50,0.8)', color:'#F3F4F6',
              border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer',
              fontSize:'0.875rem', fontWeight:500,
            }}
          >
            ↺ Analyze Another
          </button>
          <button
            onClick={handleDownloadPDF}
            style={{
              display:'flex', alignItems:'center', gap:'0.5rem',
              padding:'0.5rem 1.25rem', borderRadius:'0.5rem',
              background:'#3B82F6', color:'white',
              border:'none', cursor:'pointer',
              fontSize:'0.875rem', fontWeight:600,
              boxShadow:'0 4px 15px rgba(59,130,246,0.3)',
            }}
          >
            ↓ Download PDF Report
          </button>
        </div>
      </div>

      {demoMode ? (
        <ExecutiveSummary data={data} />
      ) : (
        <>
          <OverviewCards data={data.overview} />
          <PipelineArchitecture />
          <ErrorAnalysis pipelineInfo={data.pipelineInfo} />
          <Visualizations data={data} />
          <ExplainabilityCard classification={data.classification} />
          <FeatureEngineering features={data.acousticFeatures} />
          <PerformanceProfiler timings={data.performanceTimings} />
        </>
      )}

      <ReportGenerator data={data} />
    </div>
  );
};

export default Dashboard;
