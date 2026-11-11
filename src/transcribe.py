import av
import numpy as np
import torch
from transformers import AutoModelForRNNT, AutoProcessor

MODEL_ID = "nvidia/nemotron-speech-streaming-en-0.6b"
SAMPLE_RATE = 16000
MIN_SECONDS = 0.3


def load_audio(file):
    resampler = av.AudioResampler(format="flt", layout="mono", rate=SAMPLE_RATE)
    pieces = []
    with av.open(file, mode="r") as container:
        for frame in container.decode(audio=0):
            pieces += [part.to_ndarray().reshape(-1) for part in resampler.resample(frame)]
    pieces += [part.to_ndarray().reshape(-1) for part in resampler.resample(None)]
    return np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)


class FileTranscriber:
    def __init__(self, model_id=MODEL_ID):
        self.processor = AutoProcessor.from_pretrained(model_id)
        self.model = AutoModelForRNNT.from_pretrained(model_id).to("cpu")

    def transcribe(self, audio):
        if len(audio) < SAMPLE_RATE * MIN_SECONDS:
            return ""
        inputs = self.processor(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt")
        with torch.no_grad():
            output = self.model.generate(**inputs)
        return self.processor.batch_decode(output.sequences, skip_special_tokens=True)[0].strip()

    def transcribe_file(self, file):
        return self.transcribe(load_audio(file))
