// -- Functions ----------------------------------------------------------------

// A one-channel offline render downmixes and resamples in one pass.
async function resampleMono(buffer: AudioBuffer, sampleRate: number): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, Math.ceil(buffer.duration * sampleRate), sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  return rendered.getChannelData(0).slice();
}

// -- Exports ------------------------------------------------------------------

export { resampleMono };
