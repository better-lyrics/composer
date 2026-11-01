// -- Types ---------------------------------------------------------------------

interface TapState {
  taps: readonly number[];
  bpm: number | null;
}

// -- Constants -----------------------------------------------------------------

const TAP_RESET_MS = 2000;
const TAP_WINDOW = 9;
const MIN_BPM = 30;
const MAX_BPM = 300;
const EMPTY_TAPS: TapState = { taps: [], bpm: null };

// -- Tapping -------------------------------------------------------------------

function tapTempo(state: TapState, now: number): TapState {
  const last = state.taps.at(-1);
  const kept = last !== undefined && (now <= last || now - last > TAP_RESET_MS) ? [] : state.taps;
  const taps = [...kept, now].slice(-TAP_WINDOW);
  if (taps.length < 2) return { taps, bpm: null };
  const meanGap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
  return { taps, bpm: Math.round((60000 / meanGap) * 10) / 10 };
}

function tapAnchor(state: TapState, bpm: number): number | null {
  if (state.bpm === null) return null;
  const gap = 60000 / bpm;
  const meanPhase = state.taps.reduce((sum, tap, i) => sum + tap - i * gap, 0) / state.taps.length;
  return meanPhase / 1000;
}

// -- Typed tempo ---------------------------------------------------------------

function sanitizeBpmInput(raw: string): string {
  return raw
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/^(\d{0,3})\d*/, "$1")
    .replace(/(\.\d?).*$/, "$1");
}

function isValidBpm(bpm: number): boolean {
  return bpm >= MIN_BPM && bpm <= MAX_BPM;
}

// -- Exports -------------------------------------------------------------------

export { EMPTY_TAPS, MAX_BPM, MIN_BPM, isValidBpm, sanitizeBpmInput, tapAnchor, tapTempo };
export type { TapState };
