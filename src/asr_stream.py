"""Live microphone transcription with nvidia/nemotron-speech-streaming-en-0.6b.

The streaming code from asr_model.ipynb, wrapped so other notebooks can reuse it:

    asr = LiveTranscriber(mic="Headset CMF WASAPI")
    for sentence in asr.utterances(pause_seconds=1.5):
        print(sentence)
"""
import queue
import traceback
from threading import Event, Thread

import numpy as np
import sounddevice as sd
from transformers import AutoModelForRNNT, AutoProcessor, TextIteratorStreamer

MODEL_ID = "nvidia/nemotron-speech-streaming-en-0.6b"


class EagerTextStreamer(TextIteratorStreamer):
    """TextIteratorStreamer that emits text as soon as it is decoded.

    The stock streamer holds back the last word until a space follows it, so when the
    speaker pauses, the final word of the sentence would never arrive.
    """

    def put(self, value):
        if len(value.shape) > 1:
            value = value[0]
        self.token_cache.extend(value.tolist())
        text = self.tokenizer.decode(self.token_cache, **self.decode_kwargs)
        new_text = text[self.print_len :]
        self.print_len = len(text)
        if new_text:
            self.on_finalized_text(new_text)


class LiveTranscriber:
    def __init__(self, mic=None, model_id=MODEL_ID, lookahead_tokens=6):
        self.processor = AutoProcessor.from_pretrained(model_id)
        # load fully into RAM; device_map="auto" offloaded weights to disk and crashed the kernel
        self.model = AutoModelForRNNT.from_pretrained(model_id).to("cpu")
        self.processor.set_num_lookahead_tokens(lookahead_tokens)
        self.sampling_rate = self.processor.feature_extractor.sampling_rate
        self.mic = mic
        print(f"Streaming latency: {self.processor.streaming_latency_ms} ms")

    def utterances(self, pause_seconds=1.5):
        """Yield the transcript one utterance at a time; an utterance ends after `pause_seconds` of no new text."""
        processor, model = self.processor, self.model
        mic_q = queue.Queue()
        stop = Event()
        buffer = np.zeros(0, dtype=np.float32)
        dropped = 0  # samples already cut off the front of buffer, so buffer[0] is sample number `dropped`

        # the microphone puts audio into the queue
        def mic_callback(indata, frames, time, status):
            mic_q.put(indata[:, 0].copy())

        # move audio from the queue into the buffer until sample number n (counted from the start) has arrived
        def wait_for_samples(n):
            nonlocal buffer
            while dropped + len(buffer) < n:
                if stop.is_set():
                    raise StopIteration
                try:
                    buffer = np.concatenate([buffer, mic_q.get(timeout=0.5)])
                except queue.Empty:
                    continue

        def input_features_generator(first_chunk_inputs):
            nonlocal buffer, dropped
            yield first_chunk_inputs.input_features[:, : processor.num_mel_frames_first_audio_chunk, :]

            mel_frame_idx = processor.num_mel_frames_first_audio_chunk
            hop_length = processor.feature_extractor.hop_length
            n_fft = processor.feature_extractor.n_fft

            start_idx = mel_frame_idx * hop_length - n_fft // 2
            while True:  # a microphone never ends, so loop until stopped
                end_idx = start_idx + processor.num_samples_per_audio_chunk
                try:
                    wait_for_samples(end_idx)
                except StopIteration:
                    return
                inputs = processor(
                    buffer[start_idx - dropped : end_idx - dropped],  # absolute positions -> positions in buffer
                    sampling_rate=self.sampling_rate,
                    is_streaming=True,
                    is_first_audio_chunk=False,
                    return_tensors="pt",
                )
                inputs = inputs.to(model.device, dtype=model.dtype)
                yield inputs.input_features

                mel_frame_idx += processor.num_mel_frames_per_audio_chunk
                start_idx = mel_frame_idx * hop_length - n_fft // 2

                # audio before the next chunk's start is never read again: cut it off so memory stays constant
                buffer = buffer[start_idx - dropped :]
                dropped = start_idx

        # run generate in a thread, but print any error instead of failing silently
        def run_generate(**kwargs):
            try:
                model.generate(**kwargs)
            except Exception:
                traceback.print_exc()

        with sd.InputStream(
            device=self.mic,
            samplerate=self.sampling_rate,
            channels=1,
            dtype="float32",
            blocksize=int(self.sampling_rate * 0.08),
            callback=mic_callback,
        ):
            print("Listening... speak now (press Interrupt to stop)")
            try:
                # create the first chunk only after recording enough audio
                wait_for_samples(processor.num_samples_first_audio_chunk)
                first_chunk_inputs = processor(
                    buffer[: processor.num_samples_first_audio_chunk],
                    sampling_rate=self.sampling_rate,
                    is_streaming=True,
                    is_first_audio_chunk=True,
                    return_tensors="pt",
                )
                first_chunk_inputs = first_chunk_inputs.to(model.device, dtype=model.dtype)

                # the timeout makes the streamer raise queue.Empty when no text arrives: that is our pause detector
                streamer = EagerTextStreamer(processor.tokenizer, skip_special_tokens=True, timeout=pause_seconds)
                generate_kwargs = {
                    **first_chunk_inputs,
                    "input_features": input_features_generator(first_chunk_inputs),
                    "streamer": streamer,
                    "max_new_tokens": 100_000,
                }
                Thread(target=run_generate, kwargs=generate_kwargs, daemon=True).start()

                text = ""
                while True:
                    try:
                        chunk = next(streamer)
                        if not text.strip():
                            # punctuation that arrives after the pause belongs to the previous sentence
                            chunk = chunk.lstrip(" ?.!,")
                        print(chunk, end="", flush=True)
                        text += chunk
                    except queue.Empty:
                        if text.strip():
                            print()
                            yield text.strip()
                            text = ""
                    except StopIteration:
                        break
            finally:
                stop.set()
