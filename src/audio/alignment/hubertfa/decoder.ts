// Port of HubertFA's forced-alignment decoder (tools/decoder.py, v0.0.7). The
// benchmark numbers come from the Python version, so this follows it step for
// step, including where numpy computes in float32 vs float64 and which
// transition wins a tie.

// -- Types --------------------------------------------------------------------

interface DecoderInput {
  /** `ph_frame_logits` for one item, laid out [vocabSize, frames]. */
  frameLogits: Float32Array;
  /** `ph_edge_logits` for one item, [frames]. */
  edgeLogits: Float32Array;
  vocabSize: number;
  /** Frames in the model output. */
  frames: number;
  /** Samples in the window the model saw. */
  numSamples: number;
  sampleRate: number;
  hopSize: number;
  /** Vocabulary ids of the forced sequence. Id 0 is silence (SP). */
  phoneIds: Int32Array;
}

interface PhoneInterval {
  /** Index into `phoneIds`. */
  index: number;
  begin: number;
  end: number;
}

// -- Constants ----------------------------------------------------------------

const SILENCE_ID = 0;
const MASK = 1e9;
const EPS = 1e-6;

// -- Functions ----------------------------------------------------------------

// Per-frame log-probabilities of each sequence phone, after hiding every phone
// that isn't in the sequence (silence always stays). Laid out [S, T].
function sequenceLogProbs(input: DecoderInput, T: number): Float32Array {
  const { frameLogits, vocabSize, frames, phoneIds } = input;
  const S = phoneIds.length;
  const allowed = new Uint8Array(vocabSize);
  allowed[SILENCE_ID] = 1;
  for (const id of phoneIds) allowed[id] = 1;

  const out = new Float32Array(S * T);
  for (let t = 0; t < T; t++) {
    // numpy subtracts a float64 mask, so the softmax runs in float64.
    let max = Number.NEGATIVE_INFINITY;
    for (let v = 0; v < vocabSize; v++) {
      const x = frameLogits[v * frames + t] - (allowed[v] ? 0 : MASK);
      if (x > max) max = x;
    }
    let sum = 0;
    for (let v = 0; v < vocabSize; v++) {
      sum += Math.exp(frameLogits[v * frames + t] - (allowed[v] ? 0 : MASK) - max);
    }
    const logSum = max + Math.log(sum);
    for (let s = 0; s < S; s++) out[s * T + t] = frameLogits[phoneIds[s] * frames + t] - logSum;
  }
  return out;
}

function edgeProbabilities(edgeLogits: Float32Array, T: number): { edgeProb: Float32Array; edgeDiff: Float32Array } {
  const pred = new Float32Array(T);
  for (let t = 0; t < T; t++) pred[t] = Math.min(1, Math.max(0, 1 / (1 + Math.exp(-edgeLogits[t]))));
  const edgeProb = new Float32Array(T);
  const edgeDiff = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    edgeProb[t] = Math.min(1, Math.max(0, pred[t] + (t > 0 ? pred[t - 1] : 0)));
    edgeDiff[t] = t < T - 1 ? pred[t + 1] - pred[t] : 0;
  }
  return { edgeProb, edgeDiff };
}

// Viterbi over the forced sequence. Each frame a state either stays, advances
// one phone, or skips one silence. Returns the frame each visited state starts
// on, or null when no path reaches the end (the Python version asserts).
function viterbi(
  logProbs: Float32Array,
  edgeProb: Float32Array,
  phoneIds: Int32Array,
  T: number,
): { states: number[]; starts: number[] } | null {
  const S = phoneIds.length;
  const f = Math.fround;
  const dp = new Float32Array(S * T).fill(Number.NEGATIVE_INFINITY);
  const back = new Int8Array(S * T).fill(-1);
  const currMax = new Float64Array(S).fill(Number.NEGATIVE_INFINITY);
  const at = (s: number, t: number) => s * T + t;

  dp[at(0, 0)] = logProbs[at(0, 0)];
  currMax[0] = logProbs[at(0, 0)];
  if (phoneIds[0] === SILENCE_ID && S > 1) {
    dp[at(1, 0)] = logProbs[at(1, 0)];
    currMax[1] = logProbs[at(1, 0)];
  }

  const skip = S >= 2 ? 2 : 1;
  // A two-state jump is allowed only over a silence (or onto the last state).
  const canSkipInto = new Uint8Array(S);
  for (let i = skip; i < S; i++) {
    const over = Math.min(Math.max(i - skip + 1, 0), S - 1);
    canSkipInto[i] = over >= S - 1 || phoneIds[over] === SILENCE_ID ? 1 : 0;
  }
  const edgeLog = new Float32Array(T);
  const notEdgeLog = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    edgeLog[t] = Math.log(f(edgeProb[t] + EPS));
    notEdgeLog[t] = Math.log(f(f(1 - edgeProb[t]) + EPS));
  }
  const durationWeight = T / S;
  const nextMax = new Float64Array(S);

  for (let t = 1; t < T; t++) {
    for (let s = 0; s < S; s++) {
      const stay = f(f(dp[at(s, t - 1)] + logProbs[at(s, t)]) + notEdgeLog[t]);
      let advance = Number.NEGATIVE_INFINITY;
      if (s >= 1) {
        const from = s - 1;
        advance = f(f(f(dp[at(from, t - 1)] + logProbs[at(from, t)]) + edgeLog[t]) + currMax[from] * durationWeight);
      }
      let jump = Number.NEGATIVE_INFINITY;
      if (s >= skip && canSkipInto[s]) {
        const from = s - skip;
        jump = f(f(f(dp[at(from, t - 1)] + logProbs[at(from, t)]) + edgeLog[t]) + currMax[from] * durationWeight);
      }
      // numpy's argmax keeps the first maximum: stay, then advance, then jump.
      let best = stay;
      let move = 0;
      if (advance > best) {
        best = advance;
        move = 1;
      }
      if (jump > best) {
        best = jump;
        move = 2;
      }
      dp[at(s, t)] = best;
      back[at(s, t)] = move;
      const p = logProbs[at(s, t)];
      nextMax[s] = phoneIds[s] === SILENCE_ID ? 0 : move === 0 ? Math.max(currMax[s], p) : p;
    }
    currMax.set(nextMax);
  }

  let s = S === 1 ? 0 : dp[at(S - 2, T - 1)] > dp[at(S - 1, T - 1)] && phoneIds[S - 1] === SILENCE_ID ? S - 2 : S - 1;
  const states: number[] = [];
  const starts: number[] = [];
  for (let t = T - 1; t >= 0; t--) {
    const move = back[at(s, t)];
    if (move < 0 && t !== 0) return null;
    if (move !== 0) {
      states.push(s);
      starts.push(t);
      if (move === 1) s -= 1;
      else if (move === 2) s -= 2;
    }
  }
  states.reverse();
  starts.reverse();
  return { states, starts };
}

// Phone intervals in seconds from the window start, in sung order. Each
// boundary is nudged by up to half a frame toward where the edge detector's
// output changes fastest.
function decodeAlignment(input: DecoderInput): PhoneInterval[] | null {
  const S = input.phoneIds.length;
  const numFrames = Math.floor((input.numSamples + 0.5) / input.hopSize);
  const T = Math.min(numFrames, input.frames);
  if (S === 0 || T === 0) return null;

  const logProbs = sequenceLogProbs(input, T);
  const { edgeProb, edgeDiff } = edgeProbabilities(input.edgeLogits, T);
  const path = viterbi(logProbs, edgeProb, input.phoneIds, T);
  if (!path) return null;

  const frameSeconds = input.hopSize / input.sampleRate;
  const times = path.starts.map((frame) => {
    const shift = Math.min(0.5, Math.max(-0.5, edgeDiff[frame] / 2));
    return Math.max(0, frameSeconds * (frame + shift));
  });
  times.push(frameSeconds * T);
  return path.states.map((index, i) => ({ index, begin: times[i], end: times[i + 1] }));
}

// -- Exports ------------------------------------------------------------------

export { decodeAlignment };
export type { PhoneInterval };
