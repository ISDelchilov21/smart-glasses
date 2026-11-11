export function encodeWav(frames: ArrayLike<number>[], sampleRate: number): Uint8Array {
  const sampleCount = frames.reduce((total, frame) => total + frame.length, 0);
  const view = new DataView(new ArrayBuffer(44 + sampleCount * 2));
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  let offset = 44;
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i++) {
      view.setInt16(offset, frame[i], true);
      offset += 2;
    }
  }
  return new Uint8Array(view.buffer);
}
