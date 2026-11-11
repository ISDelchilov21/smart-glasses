export type RunModel = (input: Float32Array, dims: number[]) => Promise<Float32Array>;

export type WakeWordModels = {
  melspectrogram: RunModel;
  embedding: RunModel;
  wakeWord: RunModel;
};

type Session = {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(feeds: Record<string, any>): Promise<Record<string, { data: unknown }>>;
};

type TensorClass = new (type: 'float32', data: Float32Array, dims: number[]) => unknown;

export const SAMPLE_RATE = 16000;
export const FRAME_LENGTH = 1280;
export const WAKE_THRESHOLD = 0.5;
const MEL_CONTEXT = 480;
const MEL_BINS = 32;
const MEL_WINDOW = 76;
const FEATURE_WINDOW = 16;

export function sessionRunner(session: Session, Tensor: TensorClass): RunModel {
  const [inputName] = session.inputNames;
  const [outputName] = session.outputNames;
  return async (input, dims) => {
    const outputs = await session.run({ [inputName]: new Tensor('float32', input, dims) });
    return Float32Array.from(outputs[outputName].data as Float32Array);
  };
}

export class WakeWordDetector {
  models: WakeWordModels;
  audio = new Float32Array(0);
  mel: Float32Array[] = [];
  features: Float32Array[] = [];

  constructor(models: WakeWordModels) {
    this.models = models;
    this.reset();
  }

  reset() {
    this.audio = new Float32Array(0);
    this.mel = Array.from({ length: MEL_WINDOW }, () => new Float32Array(MEL_BINS).fill(1));
    this.features = [];
  }

  async score(frame: ArrayLike<number>): Promise<number> {
    if (frame.length !== FRAME_LENGTH) {
      throw new Error(`A frame must have ${FRAME_LENGTH} samples, not ${frame.length}.`);
    }
    const keep = Math.min(this.audio.length, MEL_CONTEXT);
    const audio = new Float32Array(keep + FRAME_LENGTH);
    audio.set(this.audio.subarray(this.audio.length - keep));
    audio.set(Float32Array.from(frame), keep);
    this.audio = audio;

    const mel = await this.models.melspectrogram(audio, [1, audio.length]);
    for (let start = 0; start + MEL_BINS <= mel.length; start += MEL_BINS) {
      this.mel.push(mel.slice(start, start + MEL_BINS).map((value) => value / 10 + 2));
    }
    this.mel = this.mel.slice(-MEL_WINDOW);

    const window = new Float32Array(MEL_WINDOW * MEL_BINS);
    this.mel.forEach((row, index) => window.set(row, index * MEL_BINS));
    this.features.push(await this.models.embedding(window, [1, MEL_WINDOW, MEL_BINS, 1]));
    this.features = this.features.slice(-FEATURE_WINDOW);
    if (this.features.length < FEATURE_WINDOW) {
      return 0;
    }

    const size = this.features[0].length;
    const input = new Float32Array(FEATURE_WINDOW * size);
    this.features.forEach((feature, index) => input.set(feature, index * size));
    const [score] = await this.models.wakeWord(input, [1, FEATURE_WINDOW, size]);
    return score;
  }
}
