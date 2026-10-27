// -- Types --------------------------------------------------------------------

type EnvelopePoint = { at: number; value: number };

interface ScrubSound {
  source: AudioBufferSourceNode;
  gain: GainNode;
  envelope: EnvelopePoint[];
  endsAt: number;
}

interface ScrubSoundOptions {
  buffer: AudioBuffer;
  offset: number;
  at: number;
  volume: number;
  rate: number;
  fadeS: number;
  lengthS?: number;
}

// -- Functions ----------------------------------------------------------------

function envelopeValueAt(envelope: EnvelopePoint[], at: number): number {
  let previous: EnvelopePoint | null = null;
  for (const point of envelope) {
    if (point.at > at) {
      if (!previous) return point.value;
      const progress = (at - previous.at) / (point.at - previous.at);
      return previous.value + (point.value - previous.value) * progress;
    }
    previous = point;
  }
  return previous?.value ?? 0;
}

function scheduleEnvelope(gain: GainNode, envelope: EnvelopePoint[]): void {
  const [first, ...rest] = envelope;
  gain.gain.setValueAtTime(first.value, first.at);
  for (const point of rest) gain.gain.linearRampToValueAtTime(point.value, point.at);
}

function startScrubSound(ctx: AudioContext, options: ScrubSoundOptions): ScrubSound {
  const { buffer, offset, at, volume, rate, fadeS, lengthS } = options;
  const source = new AudioBufferSourceNode(ctx, { buffer, playbackRate: rate });
  // Starting at 0, not the default 1, keeps a frame that rounds ahead of the first event silent.
  const gain = new GainNode(ctx, { gain: 0 });
  const envelope: EnvelopePoint[] = [
    { at, value: 0 },
    { at: at + fadeS, value: volume },
  ];
  if (lengthS !== undefined) {
    envelope.push({ at: at + lengthS - fadeS, value: volume }, { at: at + lengthS, value: 0 });
  }
  scheduleEnvelope(gain, envelope);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.addEventListener("ended", () => {
    source.disconnect();
    gain.disconnect();
  });
  source.start(at, offset);
  const endsAt = lengthS === undefined ? Number.POSITIVE_INFINITY : at + lengthS;
  if (lengthS !== undefined) source.stop(endsAt);
  return { source, gain, envelope, endsAt };
}

// Ramps from the value scheduled for `at`, since `gain.value` lags the render thread.
function rampEnvelope(sound: ScrubSound, at: number, fadeS: number, value: number): void {
  const from = envelopeValueAt(sound.envelope, at);
  const earlier = sound.envelope.filter((point) => point.at < at);
  const param = sound.gain.gain;
  param.cancelScheduledValues(at);
  // Ramping to the held value keeps a fade-in that the cancel cut short on its line.
  if (earlier.length > 0) param.linearRampToValueAtTime(from, at);
  else param.setValueAtTime(from, at);
  param.linearRampToValueAtTime(value, at + fadeS);
  sound.envelope = [...earlier, { at, value: from }, { at: at + fadeS, value }];
}

function fadeOutScrubSound(sound: ScrubSound, at: number, fadeS: number): void {
  if (at + fadeS >= sound.endsAt) return;
  rampEnvelope(sound, at, fadeS, 0);
  sound.endsAt = at + fadeS;
  sound.source.stop(sound.endsAt);
}

function retargetScrubSoundVolume(sound: ScrubSound, at: number, volume: number, fadeS: number): void {
  if (sound.endsAt !== Number.POSITIVE_INFINITY || sound.envelope.at(-1)?.value === volume) return;
  rampEnvelope(sound, at, fadeS, volume);
}

// -- Exports ------------------------------------------------------------------

export { fadeOutScrubSound, retargetScrubSoundVolume, startScrubSound };
export type { ScrubSound };
