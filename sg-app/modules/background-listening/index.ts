import { requireOptionalNativeModule } from 'expo';

type BackgroundListeningModule = {
  start(text: string): void;
  update(text: string): void;
  stop(): boolean;
};

export default requireOptionalNativeModule<BackgroundListeningModule>('BackgroundListening');
