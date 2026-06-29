# ABLEPRO: Speech Diagnostic Engine 🎙️✨

**A highly robust, explainable AI pipeline for clinical Kannada speech analysis.**

ABLEPRO is an advanced, hybrid cloud/offline medical diagnostic tool. It takes raw Kannada speech audio and automatically extracts clinical biomarkers, transcribes the speech, perfectly diarizes the speakers, and provides an explainable prediction of the patient's demographics and vocal health.

---

## 🏆 Key Innovations & Hackathon Highlights

1. **Hybrid Cloud + Offline AI (Automatic Failover):**
   - **Primary:** Lightning-fast Sarvam AI Saaras v3 cloud API.
   - **Bulletproof Fallback:** If the network drops or API credits deplete, the system instantly catches the exception (zero latency) and routes the audio to a local **Whisper Large-v3** model sitting in the GPU VRAM.
2. **GPU Accelerated Inference on Consumer Hardware:**
   - Squeezed the massive 1.5-billion parameter Whisper Large-v3 model into a 6GB RTX 4050 GPU using `int8_float16` quantization and CTranslate2.
3. **Medical Domain Adaptation:**
   - Implements a custom JSON-based dictionary spellchecker that instantly corrects out-of-vocabulary or hallucinated medical terms in the Kannada language.
4. **Explainable AI (XAI):**
   - The Random Forest classifier doesn't just output "Male" or "Atypical". It provides a human-readable clinical explanation citing exact acoustic metrics (e.g., Pitch, Jitter) and their threshold violations.
5. **Live Progress Streaming (SSE):**
   - The FastAPI backend streams real-time state updates using Server-Sent Events, ensuring the React UI remains fully responsive with dynamic progress badges.
6. **Downloadable PDF Reports:**
   - Judges and clinicians can instantly export a fully formatted clinical summary containing all graphs, metrics, and diarized transcripts.

---

## ⚙️ Architecture Pipeline

1. **Data Preprocessing:** Audio Validation ➔ Mono Conversion ➔ 16kHz Resampling ➔ Loudness Normalization ➔ Spectral Denoise.
2. **Speaker Diarization:** Hugging Face `Pyannote 3.1` segments "Speaker 1" vs "Speaker 2".
3. **Voice Activity Detection:** `Silero VAD` filters out non-speech audio to prevent hallucinations.
4. **Feature Extraction:** `Librosa` calculates Pitch, Jitter, Shimmer, MFCCs, Spectral Centroids, and Formants.
5. **Transcription (STT):** Cloud (Sarvam) or Local GPU (Whisper) generates Kannada text.
6. **Classification:** Clinical Rule Engine + Random Forest generate Explainable AI predictions.

---

## 🚀 Setting Up the Magic! (Installation & Setup)

Think of ABLEPRO like a super-smart robot that needs two things to work: a **brain** (the backend) and a **face** (the frontend). Here is how you wake both of them up!

### What you need before starting:
- **Python 3.10+** (The robot's language)
- **Node.js & npm** (The robot's paint tools)
- **NVIDIA GPU** (A strong engine so the robot can think fast, with at least 6GB VRAM)

---

### 1. Waking up the Brain 🧠 (Backend)
First, we need to teach the robot how to listen to audio. Open your terminal (the black screen where you type commands) and type these one by one:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
*(This creates a cozy little room for the brain and puts all its books inside!)*

### 2. Giving the Robot its Magic Keys 🔑 (`backend/.env`)
The robot needs a secret password to access the internet. Inside the `backend` folder, create a new file called `.env` and paste this inside:

```env
SARVAM_API_KEY=your_sarvam_key
HF_TOKEN=your_huggingface_token
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=int8_float16
WHISPER_MODEL_SIZE=large-v3
CUDA_FAIL_HARD=false
ENABLE_DENOISING=true
```

### 3. Painting the Face 🎨 (Frontend)
Now let's build the shiny buttons you will click on. Go back to your terminal and type:

```bash
cd frontend
npm install
```

---

## 💻 Let's Play! (How to Run)

To play with the robot, you have to turn on both the Brain and the Face at the same time in two different terminal windows.

**Terminal 1: Start the Brain (Backend)**
```bash
cd backend
venv\Scripts\activate
python main.py
```
*(Note: The very first time you do this, the robot has to download a big dictionary, so it might take a few minutes! Just let it think until it says "Uvicorn running".)*

**Terminal 2: Start the Face (Frontend)**
```bash
cd frontend
npm run dev
```

**Step 3:** Open your favorite web browser (like Chrome or Edge) and go to this link: `http://localhost:5173`. 
Ta-da! 🎉 You are ready to start analyzing speech!

---

## 📊 Demo Mode (Presentation View)

For hackathon judging or executive presentations, toggle the **"Presentation Mode (Demo)"** checkbox on the top right of the dashboard. This collapses the deep technical metrics into a gorgeous, high-level Executive Summary Card showcasing the Audio Duration, Number of Speakers, Fallback Status, Execution Time, and Final Clinical Diagnosis.

---

## ⚠️ Known Limitations & Future Work

- **Multiple Simultaneous Speakers:** Heavy cross-talk can still confuse both Pyannote and Whisper.
- **Diarization Leakage:** Occasionally, trailing syllables are attributed to the wrong speaker.
- **Rule-based Bias:** The current clinical thresholds are based on Western acoustic norms (e.g., Titze 1994) which may require calibration for specific regional Kannada demographics.
