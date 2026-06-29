import time
import psutil
import os
import gc
from faster_whisper import WhisperModel

def run_benchmark(model_size, audio_file):
    print(f"\n--- Benchmarking {model_size} ---")
    gc.collect()
    start_mem = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
    
    start_load = time.time()
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    load_time = time.time() - start_load
    
    mem_after_load = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
    
    start_infer = time.time()
    segments, info = model.transcribe(audio_file, language="kn", beam_size=5)
    # force generator evaluation
    text = " ".join([s.text for s in segments])
    infer_time = time.time() - start_infer
    
    mem_after_infer = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
    
    print(f"Load time: {load_time:.2f}s")
    print(f"Inference time: {infer_time:.2f}s")
    print(f"Memory (Model Load): {mem_after_load - start_mem:.2f} MB (Total: {mem_after_load:.2f} MB)")
    print(f"Memory (Peak Infer): {mem_after_infer - start_mem:.2f} MB (Total: {mem_after_infer:.2f} MB)")
    print(f"Transcription:\n{text[:200]}...")

if __name__ == "__main__":
    audio = "../Datasets/Sample8W.wav"
    if not os.path.exists(audio):
        print(f"Audio file {audio} not found!")
    else:
        run_benchmark("base", audio)
        run_benchmark("large-v3", audio)
