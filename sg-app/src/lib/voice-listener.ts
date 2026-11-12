import { VoiceProcessor } from '@picovoice/react-native-voice-processor';

import { FRAME_LENGTH, SAMPLE_RATE, WAKE_THRESHOLD, WakeWordDetector } from '@/lib/wake-word';
import { loadWakeWordModels } from '@/lib/wake-word-models';
import { encodeWav } from '@/lib/wav';

export type ListenerMode = 'off' | 'wake' | 'command' | 'enroll';

export type ListenerEvents = {
  onModeChange: (mode: ListenerMode) => void;
  onCommand: (wav: Uint8Array, wakeClip: Uint8Array | null) => void;
  onNothingHeard: () => void;
  onEnrollProgress: (count: number) => void;
  onEnrollDone: (clips: Uint8Array[]) => void;
  onError: (message: string) => void;
};

export const ENROLL_CLIPS = 5;
const ENROLL_THRESHOLD = 0.3;
const FRAMES_PER_SECOND = SAMPLE_RATE / FRAME_LENGTH;
const WAKE_CLIP_FRAMES = Math.round(2 * FRAMES_PER_SECOND);
const END_SILENCE_FRAMES = Math.round(1.2 * FRAMES_PER_SECOND);
const GIVE_UP_FRAMES = Math.round(6 * FRAMES_PER_SECOND);
const MAX_COMMAND_FRAMES = Math.round(15 * FRAMES_PER_SECOND);
const MIN_COMMAND_FRAMES = Math.round(0.5 * FRAMES_PER_SECOND);
const MIN_SPEECH_LEVEL = 500;
const MAX_QUEUED_FRAMES = 12;
const NOISE_HISTORY = 50;

function loudness(frame: number[]) {
  let sum = 0;
  for (const sample of frame) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / frame.length);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class VoiceListener {
  events: ListenerEvents;
  processor = VoiceProcessor.instance;
  mode: ListenerMode = 'off';
  wakeWordOn = false;
  paused = false;
  detector: WakeWordDetector | null = null;
  queue: Promise<void> = Promise.resolve();
  queued = 0;
  noiseLevels: number[] = [];
  recent: number[][] = [];
  wakeClip: Uint8Array | null = null;
  command: number[][] = [];
  heardSpeech = false;
  silentFrames = 0;
  enrollClips: Uint8Array[] = [];

  constructor(events: ListenerEvents) {
    this.events = events;
    this.processor.addFrameListener(this.handleFrame);
    this.processor.addErrorListener(this.handleError);
  }

  dispose() {
    this.processor.removeFrameListener(this.handleFrame);
    this.processor.removeErrorListener(this.handleError);
    this.setMode('off');
  }

  async loadDetector() {
    if (!this.detector) {
      this.detector = new WakeWordDetector(await loadWakeWordModels());
    }
    return this.detector;
  }

  async setWakeWord(on: boolean) {
    this.wakeWordOn = on;
    if (on) {
      try {
        await this.loadDetector();
      } catch (error) {
        this.wakeWordOn = false;
        this.events.onError(`The wake word could not start: ${errorMessage(error)}`);
      }
    }
    await this.refresh();
  }

  async setPaused(paused: boolean) {
    this.paused = paused;
    if (paused && (this.mode === 'command' || this.mode === 'enroll')) {
      this.command = [];
      this.enrollClips = [];
    }
    await this.refresh(paused);
  }

  async startCommand(wakeClip: Uint8Array | null = null) {
    this.command = [];
    this.heardSpeech = false;
    this.silentFrames = 0;
    this.wakeClip = wakeClip;
    await this.setMode('command');
  }

  finishCommand(byHand = false) {
    if (this.mode !== 'command') {
      return;
    }
    const frames = this.command;
    const wanted = byHand ? frames.length >= MIN_COMMAND_FRAMES : this.heardSpeech;
    this.command = [];
    this.detector?.reset();
    this.refresh(true);
    if (wanted) {
      this.events.onCommand(encodeWav(frames, SAMPLE_RATE), this.wakeClip);
    } else {
      this.events.onNothingHeard();
    }
  }

  cancelCommand() {
    this.command = [];
    this.detector?.reset();
    this.refresh(true);
  }

  async startEnroll() {
    try {
      await this.loadDetector();
    } catch (error) {
      this.events.onError(`The wake word could not start: ${errorMessage(error)}`);
      return;
    }
    this.enrollClips = [];
    this.recent = [];
    this.detector?.reset();
    this.events.onEnrollProgress(0);
    await this.setMode('enroll');
  }

  cancelEnroll() {
    this.enrollClips = [];
    this.detector?.reset();
    this.refresh(true);
  }

  async refresh(leaveBusyMode = false) {
    if ((this.mode === 'command' || this.mode === 'enroll') && !leaveBusyMode) {
      return;
    }
    const listenForWakeWord = this.wakeWordOn && this.detector && !this.paused;
    await this.setMode(listenForWakeWord ? 'wake' : 'off');
  }

  async setMode(mode: ListenerMode) {
    if (mode === this.mode) {
      return;
    }
    const micWasOn = this.mode !== 'off';
    this.mode = mode;
    this.events.onModeChange(mode);
    try {
      if (mode === 'off' && micWasOn) {
        await this.processor.stop();
      } else if (mode !== 'off' && !micWasOn) {
        if (!(await this.processor.hasRecordAudioPermission())) {
          throw new Error('Jarvis needs microphone permission to hear you. Allow it in the phone settings.');
        }
        await this.processor.start(FRAME_LENGTH, SAMPLE_RATE);
      }
    } catch (error) {
      this.mode = 'off';
      this.events.onModeChange('off');
      this.events.onError(errorMessage(error));
    }
  }

  handleError = (error: Error) => {
    this.events.onError(`Microphone problem: ${error.message}`);
  };

  handleFrame = (frame: number[]) => {
    if (this.mode === 'command') {
      this.addCommandFrame(frame);
      return;
    }
    if (this.mode !== 'wake' && this.mode !== 'enroll') {
      return;
    }
    this.recent = [...this.recent.slice(1 - WAKE_CLIP_FRAMES), frame];
    if (this.mode === 'wake') {
      this.noiseLevels = [...this.noiseLevels.slice(1 - NOISE_HISTORY), loudness(frame)];
    }
    if (this.queued >= MAX_QUEUED_FRAMES) {
      return;
    }
    this.queued++;
    this.queue = this.queue.then(() => this.checkWakeWord(frame)).finally(() => this.queued--);
  };

  speechLevel() {
    const sorted = [...this.noiseLevels].sort((a, b) => a - b);
    const noise = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
    return Math.max(noise * 3, MIN_SPEECH_LEVEL);
  }

  takeRecentClip() {
    const clip = encodeWav(this.recent, SAMPLE_RATE);
    this.recent = [];
    return clip;
  }

  async checkWakeWord(frame: number[]) {
    const mode = this.mode;
    if ((mode !== 'wake' && mode !== 'enroll') || !this.detector) {
      return;
    }
    try {
      const score = await this.detector.score(frame);
      if (this.mode !== mode) {
        return;
      }
      if (mode === 'wake' && score >= WAKE_THRESHOLD) {
        this.detector.reset();
        await this.startCommand(this.takeRecentClip());
      } else if (mode === 'enroll' && score >= ENROLL_THRESHOLD) {
        this.detector.reset();
        this.addEnrollClip(this.takeRecentClip());
      }
    } catch (error) {
      this.events.onError(`Wake word problem: ${errorMessage(error)}`);
    }
  }

  addEnrollClip(clip: Uint8Array) {
    this.enrollClips.push(clip);
    this.events.onEnrollProgress(this.enrollClips.length);
    if (this.enrollClips.length >= ENROLL_CLIPS) {
      const clips = this.enrollClips;
      this.enrollClips = [];
      this.refresh(true);
      this.events.onEnrollDone(clips);
    }
  }

  addCommandFrame(frame: number[]) {
    this.command.push(frame);
    if (loudness(frame) > this.speechLevel()) {
      this.heardSpeech = true;
      this.silentFrames = 0;
    } else {
      this.silentFrames++;
    }

    const length = this.command.length;
    if (this.heardSpeech && this.silentFrames >= END_SILENCE_FRAMES) {
      this.finishCommand();
    } else if (!this.heardSpeech && length >= GIVE_UP_FRAMES) {
      this.finishCommand();
    } else if (length >= MAX_COMMAND_FRAMES) {
      this.finishCommand();
    }
  }
}
