import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader } from 'lucide-react';

const LiveMicrophone = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording(false);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const drawWaveform = () => {
    if (!analyzerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzerRef.current.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgb(11, 15, 25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(99, 102, 241)';
    ctx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Web Audio API for waveform
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyzerRef.current);
      analyzerRef.current.fftSize = 2048;

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType });
        
        // Convert Blob to WAV using Web Audio API
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
          const wavBlob = audioBufferToWav(audioBuffer);
          const file = new File([wavBlob], 'live_recording.wav', { type: 'audio/wav' });
          onRecordingComplete(file);
        } catch (e) {
          console.error("Audio conversion failed:", e);
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(t => t.stop());
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      drawWaveform();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = (process = true) => {
    if (mediaRecorderRef.current && isRecording) {
      if (!process) {
        mediaRecorderRef.current.onstop = null; // Don't trigger processing if unmounting
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // Utility: Convert AudioBuffer to WAV format
  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [],
      sampleRate = buffer.sampleRate;
    let offset = 0, pos = 0;

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  return (
    <div className="flex flex-col items-center bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl w-full">
      <h3 className="text-xl font-bold text-white mb-4">Live Microphone Mode</h3>
      
      <div className="w-full bg-[#0B0F19] rounded-lg overflow-hidden border border-gray-700 mb-6 flex justify-center items-center h-[120px]">
        <canvas ref={canvasRef} width="600" height="120" className="w-full h-full object-cover" />
        {!isRecording && !isProcessing && (
          <div className="absolute text-gray-500 font-medium tracking-wide pointer-events-none">
            Ready to Record
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white font-semibold rounded-full transition-all shadow-[0_0_15px_rgba(79,70,229,0.5)]"
          >
            {isProcessing ? <Loader className="animate-spin w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {isProcessing ? 'Processing Audio...' : 'Start Recording'}
          </button>
        ) : (
          <button
            onClick={() => stopRecording(true)}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-full transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse"
          >
            <Square className="w-5 h-5" fill="currentColor" />
            Stop & Analyze
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveMicrophone;
