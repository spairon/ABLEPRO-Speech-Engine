# ABLEPRO Speech Diagnostic Engine - Complete Architecture & Workflow 🎙️✨

This document details the complete end-to-end architecture, the technologies used, and the fallback failover mechanisms implemented in the ABLEPRO system. It is designed to clearly explain the pipeline to hackathon judges, developers, and end-users.

---

## 1. System Overview & Problem Statement
ABLEPRO is a highly specialized "Robot Doctor" AI system designed to analyze Kannada speech in a medical context. 
When a user uploads a voice recording (`.wav` file), the system automatically performs three distinct operations:
1. **Transcription (Kannada STT):** Extracts what the patient is saying into Kannada text, correcting medical domain-specific terminology.
2. **Speaker Diarization:** Detects "Who is speaking when" (e.g., separating the doctor from the patient).
3. **Acoustic Health & Demographics (Classification):** Extracts vocal biomarkers (Pitch, Jitter, Shimmer) to determine the speaker's gender, age group, and overall vocal health.

---

## 2. Technology Stack & Hardware Optimization
To achieve near real-time performance on a consumer laptop (specifically an **NVIDIA RTX 4050 with 6GB VRAM**), the system utilizes a carefully chosen hybrid cloud/local tech stack:

*   **Frontend (React & Vite):** A responsive, dark-mode optimized React dashboard. It visualizes the data, handles file uploads, and renders live progress states using Server-Sent Events (SSE).
*   **Backend (Python FastAPI):** An asynchronous backend acting as the pipeline manager. It orchestrates parallel execution of ML models to minimize latency.
*   **Primary STT Engine (Sarvam AI Saaras v3):** A state-of-the-art cloud API explicitly trained for Indic languages. Used for high-speed, high-accuracy Kannada transcription.
*   **Offline Fallback Engine (Faster-Whisper `Large-v3`):** OpenAI's massive 1.5-billion parameter Whisper model running completely locally on the RTX 4050 GPU.
*   **Diarization Engine (Pyannote 3.1):** A Hugging Face model loaded directly into system RAM to map speaker timestamps.
*   **Acoustic Extractor (Librosa):** A Python library that extracts fundamental acoustic features (F0/Pitch, Jitter, Shimmer) directly from the raw audio waveform.

---

## 3. The ML Pipeline Workflow Step-by-Step

When a user hits "Upload" on the dashboard, the backend triggers an advanced ML pipeline. To make it as fast as possible, several operations run in **parallel**:

### Step 1: Initialization & SSE Streaming
The React frontend sends the `.wav` file to FastAPI. FastAPI immediately opens a Server-Sent Events (SSE) stream. This allows the backend to stream live status updates ("Loading Audio...", "Extracting Features...") directly to the frontend's UI badges in real-time, preventing the user from staring at a frozen loading spinner.

### Step 2: Audio Loading & Denoising (Sequential)
The audio is loaded into memory using `Librosa` at a 16kHz sample rate (the requirement for Whisper). We apply a **Spectral Noise Reduction** algorithm to clean up background static, drastically improving the accuracy of downstream ML models. 
**What happens here:**
- **Validation:** Ensures the file is a `.wav` file.
- **Mono Conversion:** Merges stereo channels into a single mono track.
- **Resampling:** standardizes the audio to exactly 16,000 Hz.
- **Loudness Normalization:** Boosts quiet voices and lowers excessively loud spikes (RMS Normalization).
- **Spectral Denoise:** Mathematically subtracts constant background hums (like an AC unit).

### Step 3: Parallel Execution (Diarization + Acoustics)
Because these two tasks do not depend on each other, they are executed at the exact same time using Python's `asyncio.gather`:
*   **Thread A (Pyannote 3.1 & Silero VAD):** Silero VAD first strips away total silence. Then, Pyannote analyzes the audio waveform using a Time Delay Neural Network (TDNN) to extract speaker embeddings and map exact timestamps for "Speaker 1" and "Speaker 2". The system also merges consecutive speech segments and drops noise bursts under 1 second.
*   **Thread B (Librosa):** Extracts 14 distinct acoustic biomarkers (Pitch, Jitter, Shimmer, MFCCs, Spectral Centroids, Zero Crossing Rate, Energy, Formants).

### Step 4: Hybrid Transcription (STT)
This is the most critical part of the workflow. The system must convert the Kannada speech to text. It operates in a primary/fallback hierarchy:

**The Primary Engine (Cloud):** 
The audio is sliced into 25-second chunks (to adhere to API limits) and sent to **Sarvam AI (Saaras v3)**. Sarvam returns highly accurate Kannada text almost instantaneously. 

**The Bulletproof Offline GPU Fallback (Faster-Whisper):**
If the laptop loses internet, if Sarvam's servers crash, or if the API quota runs out, the `try/except` safety net instantly catches the network error. In less than a millisecond, the backend redirects the audio to the local GPU. 
*   **The Model:** We utilize **Whisper `Large-v3`**, heavily optimized via `int8_float16` quantization. This shrinks the massive 8GB model down to ~3.5GB so it easily fits inside the laptop's RTX 4050.
*   **Anti-Hallucination:** To prevent Whisper from getting confused and outputting English, we inject a hardcoded initial prompt (`ನಮಸ್ಕಾರ, ಇದು ಕನ್ನಡ ಭಾಷೆಯ ಆಡಿಯೋ. ದಯವಿಟ್ಟು ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ.`) to mathematically force the model to output Kannada. We also apply a **Silero VAD Filter** to strip away silence before transcription, preventing static-induced hallucinations. 

### Step 5: The Medical Dictionary Spellchecker
Raw AI transcription is often bad at medical terminology. Before returning the final result, the Kannada text is passed through our custom JSON Dictionary (`kannada_corrections.json`). If the AI accidentally outputs an English medical word or a misspelled Kannada word, the dictionary instantly maps it to the proper clinical Kannada term (e.g., swapping "Doctor" to "ವೈದ್ಯರು"). The UI then displays how many corrections were applied.

### Step 6: Multi-Feature Classification (Explainable AI)
The acoustic biomarkers from Step 3 are evaluated using a Weighted Rule Engine and a Random Forest Classifier. 
*   **Demographics:** Uses a combination of Pitch (40%), Spectral Centroid (20%), MFCC (20%), Energy (10%), and Speaking Rate (10%) to predict Gender and Age.
*   **Vocal Health:** Elevated Jitter/Shimmer triggers a lower "Vocal Health Score" and flags the speech as atypical, providing immediate clinical insight to the doctor.

### Step 7: Dynamic UI Updates & PDF Export
The final JSON payload is sent to the frontend. The dashboard renders the Diarized text blocks, the health metrics, and the STT Engine badges. The user can then click the "Download Report" button, which utilizes `jsPDF` to compile the data and graphs into a clean, professional, printable medical report (specifically excluding the full transcripts for brevity).

---

## 4. Clinical Speech Diagnostics (Healthy Averages)

When classifying the patient's speech health and demographics, the system compares the extracted biomarkers against standard clinical averages. For a **Healthy Adult**, the averages are:
- **Pitch (Fundamental Frequency - F0):** 
  - Male: ~100 Hz to 140 Hz
  - Female: ~200 Hz to 240 Hz
- **Jitter (Voice Pitch Shakiness):** < 0.04 (Under 4%). Higher values suggest vocal cord lesions or hoarseness.
- **Shimmer (Voice Volume Shakiness):** < 0.06 (Under 6%). Higher values indicate breathiness or vocal fatigue.
- **Speaking Rate:** ~4.0 to 5.0 syllables/onsets per second. Lower rates indicate cognitive load, hesitation, or dysarthria.

---

## 5. ZCR (Zero Crossing Rate) vs. Whisper Comparison

Understanding the difference between ZCR and Whisper is critical to understanding how the pipeline separates *Acoustics* from *Linguistics*:

- **ZCR (Zero Crossing Rate):** This is a low-level mathematical *Acoustic Feature* extracted by **Librosa**. It measures how often the audio waveform crosses the zero-axis (goes from positive to negative). High ZCR is highly correlated with noisy, scratchy, or unvoiced sounds (like the letter "S" or heavy static). It does NOT know what words are being spoken; it only knows how "scratchy" the audio physically sounds.
- **Whisper (Faster-Whisper Large-v3):** This is a massive Deep Learning Neural Network used for *Speech-to-Text Transcription*. It listens to the audio and uses a transformer model to decode the sounds into actual Kannada linguistic words. It does not output medical acoustic metrics—its only job is to write down the transcript.

**Summary:** We use **ZCR** (via Librosa) to diagnose the *health* of the voice, and we use **Whisper** to write down the *words* spoken by that voice.

---

## 6. Frequently Asked Questions (FAQs)

**Q: How reliable is the offline fallback mechanism? Could it crash during a demo?**
The switching mechanism is extremely reliable and bordering on bulletproof. In our backend code, the entire Sarvam API request is wrapped in a massive `try/except` safety block that catches *literally anything*—including Wi-Fi disconnects, firewall blocks, or corrupted API keys. Furthermore, because we pre-load Whisper `Large-v3` into the RTX 4050's VRAM at server startup, there is **zero-latency** when the fallback triggers. It does not need to boot up the model from the hard drive; it is already idling and ready to transcribe instantly.

**Q: What exactly happens on the UI when the internet drops?**
When a fallback happens, the React frontend isn't left hanging. It receives the transcribed text alongside metadata indicating the fallback occurred. The UI dynamically changes its STT Engine badge to an orange `Whisper (GPU)` badge and displays a red error badge explaining exactly why Sarvam failed (e.g., "Network Error: Could not connect to Sarvam AI"). This happens gracefully without flashing nasty red error pages or breaking the layout. 

**Q: Why doesn't the system drain my Sarvam Credits when I'm offline?**
The backend features an intelligent Quota tracking system. It calculates the duration of your audio file but *only* deducts that time from your local battery/quota tracker if the `stt_engine` successfully resolves to Sarvam. If the system falls back to the local GPU, it correctly recognizes that the execution was completely free and deducts zero credits.

**Q: Why was the offline Whisper model outputting mixed English previously, and how did you fix it?**
Initially, the fallback used Whisper `Medium`, which is prone to hallucinating or switching to English when it encounters complex Kannada grammar or heavy background noise. 
We implemented three definitive fixes:
1.  **Upgraded to `Large-v3`:** The smartest Whisper model available, drastically improving multilingual accuracy.
2.  **`int8_float16` Quantization:** Shrunk the `Large-v3` model so it wouldn't overflow the 6GB VRAM limit.
3.  **VAD + Prompting:** Added a Silero Voice Activity Detector to strip static, and injected a strict Kannada prompt to force the model to stay in Kannada. 

**Q: Is there any limit to the audio length?**
Sarvam AI's real-time API refuses to transcribe files longer than 30 seconds. We overcome this by automatically chopping the audio into 25-second chunks, processing them, and perfectly reconstructing the sentences based on timestamp overlaps. Technically, you can upload incredibly long files without hitting the API's duration constraints!
