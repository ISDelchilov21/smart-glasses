"""Speaker verification: is this MY voice? So Jarvis ignores other people saying "Hey Jarvis".

How it works: a model turns a piece of speech into a "voiceprint", 512 numbers describing how the voice
sounds (not what was said). Two clips of the same person give similar voiceprints. "Similar" is measured
with cosine similarity: 1.0 = pointing the same way, 0 = unrelated.
Record your profile once with enroll_voice.py.
"""
from pathlib import Path

import numpy as np
import torch
from transformers import AutoFeatureExtractor, WavLMForXVector

MODEL_ID = "microsoft/wavlm-base-plus-sv"
PROFILE_FILE = Path(__file__).parent.parent / "models" / "my_voice.npy"


class SpeakerCheck:
    def __init__(self, threshold=0.86, profile_file=PROFILE_FILE):
        self.extractor = AutoFeatureExtractor.from_pretrained(MODEL_ID)
        self.model = WavLMForXVector.from_pretrained(MODEL_ID).eval()
        self.threshold = threshold
        self.profile_file = Path(profile_file)
        self.profile = np.load(self.profile_file) if self.profile_file.exists() else None

    def voiceprint(self, audio):
        """512 numbers for one clip (float audio, 16 kHz), scaled to length 1 so a dot product = cosine similarity."""
        inputs = self.extractor(audio, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            vector = self.model(**inputs).embeddings[0]
        return torch.nn.functional.normalize(vector, dim=-1).numpy()

    def is_me(self, audio):
        """Returns (yes/no, similarity). Without a profile, everyone is let through."""
        if self.profile is None:
            return True, None
        similarity = float(np.dot(self.voiceprint(audio), self.profile))
        return similarity >= self.threshold, similarity

    def enroll(self, clips):
        """Make and save a profile from several clips of your voice: the average of their voiceprints."""
        prints = [self.voiceprint(clip) for clip in clips]
        profile = np.mean(prints, axis=0)
        self.profile = profile / np.linalg.norm(profile)
        self.profile_file.parent.mkdir(exist_ok=True)
        np.save(self.profile_file, self.profile)
        return [float(np.dot(p, self.profile)) for p in prints]
