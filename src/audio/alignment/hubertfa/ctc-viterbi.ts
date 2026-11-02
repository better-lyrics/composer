// CTC Viterbi forced alignment, a port of hubertfa-posttrain's ctc_viterbi
// (hfapt/ctc_aligner.py), which the tap-free study (TAPFREE.md) measured. Ties
// go the way numpy's argmax breaks them: stay, then advance, then skip.

// -- Types --------------------------------------------------------------------

interface CtcEmissions {
  /** Log-probabilities laid out [frames, classes]. Class 0 is the blank. */
  logProbs: Float32Array;
  frames: number;
  classes: number;
}

interface TokenSpan {
  /** First and last frame (inclusive) the token holds on the best path. */
  first: number;
  last: number;
  /** Summed log-probability of the token over those frames. */
  logProbSum: number;
}

// -- Constants ----------------------------------------------------------------

const BLANK = 0;
const NEG = -1e30;

// -- Functions ----------------------------------------------------------------

/**
 * Aligns `tokens` (class indices, never the blank) to frames [from, to). Returns
 * each token's span on the best path, or null when the tokens can't fit.
 * Backpointers take 2 bits per frame and state: about 24 MB for 4 minutes and
 * 2,000 phones.
 */
function ctcViterbi(emissions: CtcEmissions, tokens: Int32Array, from = 0, to = emissions.frames): TokenSpan[] | null {
  const { logProbs, classes } = emissions;
  const T = to - from;
  const S = 2 * tokens.length + 1;
  if (tokens.length === 0 || T <= 0) return null;
  const ext = new Int32Array(S);
  const skip = new Uint8Array(S);
  for (let k = 0; k < tokens.length; k++) {
    ext[2 * k + 1] = tokens[k];
    if (k > 0 && tokens[k] !== tokens[k - 1]) skip[2 * k + 1] = 1;
  }
  const back = new Uint8Array(Math.ceil((T * S) / 4));
  const score = new Float64Array(S).fill(NEG);
  score[0] = logProbs[from * classes + ext[0]];
  if (S > 1) score[1] = logProbs[from * classes + ext[1]];
  for (let t = 1; t < T; t++) {
    const row = (from + t) * classes;
    // States past 2t + 1 aren't reachable yet; descending keeps s-1 and s-2 at their old values.
    const top = Math.min(S - 1, 2 * t + 1);
    for (let s = top; s >= 0; s--) {
      let best = score[s];
      let arg = 0;
      if (s > 0 && score[s - 1] > best) {
        best = score[s - 1];
        arg = 1;
      }
      if (skip[s] && score[s - 2] > best) {
        best = score[s - 2];
        arg = 2;
      }
      score[s] = best + logProbs[row + ext[s]];
      if (arg) {
        const i = t * S + s;
        back[i >> 2] |= arg << ((i & 3) * 2);
      }
    }
  }
  let s = S === 1 || score[S - 1] >= score[S - 2] ? S - 1 : S - 2;
  if (score[s] <= NEG / 2) return null;
  const first = new Int32Array(tokens.length).fill(-1);
  const last = new Int32Array(tokens.length);
  const sum = new Float64Array(tokens.length);
  for (let t = T - 1; t >= 0; t--) {
    if (s % 2 === 1) {
      const k = (s - 1) / 2;
      if (first[k] < 0) last[k] = t;
      first[k] = t;
      sum[k] += logProbs[(from + t) * classes + ext[s]];
    }
    const i = t * S + s;
    s -= (back[i >> 2] >> ((i & 3) * 2)) & 3;
  }
  return Array.from(tokens, (_, k) => ({
    first: from + first[k],
    last: from + last[k],
    logProbSum: sum[k],
  }));
}

// -- Exports ------------------------------------------------------------------

export { BLANK as CTC_BLANK, ctcViterbi };
export type { CtcEmissions };
