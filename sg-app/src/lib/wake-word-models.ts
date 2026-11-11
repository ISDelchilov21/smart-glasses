import { Asset } from 'expo-asset';
import { NativeModules } from 'react-native';

import embeddingFile from '@/assets/models/embedding_model.onnx';
import wakeWordFile from '@/assets/models/hey_jarvis_v0.1.onnx';
import melspectrogramFile from '@/assets/models/melspectrogram.onnx';
import { sessionRunner, type RunModel, type WakeWordModels } from '@/lib/wake-word';

type Ort = typeof import('onnxruntime-react-native');

async function loadRunner(ort: Ort, modelFile: number): Promise<RunModel> {
  const [asset] = await Asset.loadAsync(modelFile);
  if (!asset.localUri) {
    throw new Error('the model file is missing from the app');
  }
  const session = await ort.InferenceSession.create(asset.localUri);
  return sessionRunner(session, ort.Tensor);
}

export async function loadWakeWordModels(): Promise<WakeWordModels> {
  if (!NativeModules.Onnxruntime) {
    throw new Error('this app build has no ONNX Runtime. Make a new development build.');
  }
  const ort = await import('onnxruntime-react-native');
  const [melspectrogram, embedding, wakeWord] = await Promise.all([
    loadRunner(ort, melspectrogramFile),
    loadRunner(ort, embeddingFile),
    loadRunner(ort, wakeWordFile),
  ]);
  return { melspectrogram, embedding, wakeWord };
}
