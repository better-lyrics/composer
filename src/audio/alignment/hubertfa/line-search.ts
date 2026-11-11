import { ctcLineBounds } from "@/audio/alignment/hubertfa/ctc-bounds";
import { CTC_BLANK } from "@/audio/alignment/hubertfa/ctc-viterbi";
import { decodeAlignment } from "@/audio/alignment/hubertfa/decoder";
import type { PhoneUnit } from "@/audio/alignment/hubertfa/g2p";
import { type PhoneSequence, buildPhoneSequence } from "@/audio/alignment/hubertfa/sequence";
import vocab from "@/audio/alignment/hubertfa/vocab.json";
import type { LineRequest } from "@/audio/alignment/hubertfa/worker-protocol";
import type { Ort, OrtTensor } from "@/audio/ort-runtime";
import type { WordInterval } from "@/domain/alignment/words";

// Where a line is in a window that also holds other singing: by the model's own "this line" output when it has
// one (hubertfa-posttrain results/trainv3/line_head), otherwise by a CTC search for the line's phones.

// -- Types --------------------------------------------------------------------

/** The lyric lines around a line, as units with phones. */
interface LineContext {
  previous: PhoneUnit[];
  next: PhoneUnit[];
}

/** The worker's reading of a line: its units when it can be pronounced. */
type Prepared = { kind: string; units?: PhoneUnit[] } | null;

type ModelOutputs = Record<string, OrtTensor>;

// -- Constants ----------------------------------------------------------------

const HOP_SIZE = 441;
// The lyrics go in as `ph_ids`, the phones of `prev SEP own SEP next` with a role per token (0 prev, 1 own, 2 next;
// each SEP takes the next segment's): the line's first 128 phones, the previous line's last 48 and the next line's
// first 48 (hfapt/text_ctx.py).
const TEXT_MAX = 128;
const CONTEXT_MAX = 48;
const TEXT_SEP = vocab.vocab_size + 2;
const LINE_INPUTS = ["ph_ids", "ph_len", "ph_role", "tap"];
const LINE_OUTPUT = "line_logits";
const NO_TAP = -1000;
// The begin tap as a soft hint: a start from 0.45 s before it to 0.15 s after is free, and each 10 ms frame
// outside that costs 0.5 (log-probability). The model's line frames weigh 0.5, clipped at +-6.
const TAP_HINT = { early: 0.45, late: 0.15, cost: 0.5 };
const LINE_GATE = { weight: 0.5, clip: 6 };

// -- Functions ----------------------------------------------------------------

/** Whether a model finds lines itself: it takes the lyrics and the tap, and says which frames are the line's. */
function isLineFinder(session: { inputNames: readonly string[]; outputNames: readonly string[] }): boolean {
  return LINE_INPUTS.every((name) => session.inputNames.includes(name)) && session.outputNames.includes(LINE_OUTPUT);
}

/** The lines around the request's, each read by the worker's `prepare` (none when it can't be pronounced). */
async function linesAround(
  request: LineRequest,
  prepare: (words: string[][]) => Promise<Prepared>,
): Promise<LineContext> {
  const units = async (words: string[][] = []) => {
    const line = words.length > 0 ? await prepare(words) : null;
    return line?.kind === "ready" ? (line.units ?? []).filter((unit) => unit.phones.length > 0) : [];
  };
  return { previous: await units(request.context?.previous), next: await units(request.context?.next) };
}

function phonesOf(units: readonly PhoneUnit[]): number[] {
  const built = buildPhoneSequence(units);
  return built.kind === "sequence" ? Array.from(built.sequence.phoneIds).filter((id) => id !== 0) : [];
}

/** What a model that finds lines is given beside the audio: the lyrics around the line, and the begin tap. */
function lineFeeds(ort: Ort, own: PhoneSequence, context: LineContext, tap?: number): Record<string, OrtTensor> {
  const prev = phonesOf(context.previous).slice(-CONTEXT_MAX);
  const next = phonesOf(context.next).slice(0, CONTEXT_MAX);
  const mine = Array.from(own.phoneIds)
    .filter((id) => id !== 0)
    .slice(0, TEXT_MAX);
  const ids = [...prev, TEXT_SEP, ...mine, TEXT_SEP, ...next];
  const roles = [...prev.map(() => 0), 1, ...mine.map(() => 1), 2, ...next.map(() => 2)];
  return {
    ph_ids: new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    ph_len: new ort.Tensor("int64", BigInt64Array.of(BigInt(ids.length)), [1]),
    ph_role: new ort.Tensor("int64", BigInt64Array.from(roles.map(BigInt)), [1, roles.length]),
    tap: new ort.Tensor("float32", Float32Array.of(tap ?? NO_TAP), [1]),
  };
}

// The last (or first) whole units of a neighbour holding at most CONTEXT_MAX phones (hfapt/nb_decode.py cut_words).
function nearestUnits(units: PhoneUnit[], last: boolean): PhoneUnit[] {
  const ordered = last ? [...units].reverse() : units;
  const kept: PhoneUnit[] = [];
  let total = 0;
  for (const unit of ordered) {
    if (total + unit.phones.length > CONTEXT_MAX) break;
    kept.push(unit);
    total += unit.phones.length;
  }
  return last ? kept.reverse() : kept;
}

/**
 * The line's span in the window, in seconds from its first sample, from a line-finding model's outputs: the
 * decoder over the previous line's last words, the line's and the next line's first, each neighbour free to go
 * unplaced, with the begin tap as a soft hint and the model's line frames as a soft gate. Null when none of the
 * line's phones is placed.
 */
function findLine(
  units: PhoneUnit[],
  context: LineContext,
  request: LineRequest,
  outputs: ModelOutputs,
): WordInterval | null {
  const previous = nearestUnits(context.previous, true);
  const built = buildPhoneSequence([...previous, ...units, ...nearestUnits(context.next, false)]);
  if (built.kind !== "sequence") return null;
  const { phoneIds, unitOf } = built.sequence;
  const isOwn = (index: number) => unitOf[index] >= previous.length && unitOf[index] < previous.length + units.length;
  const first = unitOf.findIndex((_, index) => isOwn(index));
  if (first < 0) return null;
  const logits = outputs.ph_frame_logits;
  const frame = HOP_SIZE / request.sampleRate;
  const { tap } = request;
  const hint = { from: ((tap ?? 0) - TAP_HINT.early) / frame, to: ((tap ?? 0) + TAP_HINT.late) / frame };
  const phones = decodeAlignment({
    frameLogits: logits.data,
    edgeLogits: outputs.ph_edge_logits.data,
    vocabSize: logits.dims[1],
    frames: logits.dims[2],
    numSamples: request.samples.length,
    sampleRate: request.sampleRate,
    hopSize: HOP_SIZE,
    phoneIds,
    own: {
      first,
      last: unitOf.findLastIndex((_, index) => isOwn(index)),
      ...(tap === undefined ? {} : { hint: { ...hint, cost: TAP_HINT.cost } }),
      gate: { logits: outputs[LINE_OUTPUT].data, ...LINE_GATE },
    },
  });
  const placed = phones?.filter((phone) => isOwn(phone.index)) ?? [];
  return placed.length > 0 ? { begin: placed[0].begin, end: placed[placed.length - 1].end } : null;
}

/** Where the line's phones are in the window by CTC Viterbi, in seconds from its first sample. */
function ctcSpan(sequence: PhoneSequence, request: LineRequest, ctc: OrtTensor | undefined): WordInterval | null {
  const found =
    ctc &&
    ctcLineBounds({
      logits: ctc.data,
      outputFrames: ctc.dims[2],
      numSamples: request.samples.length,
      hopSize: HOP_SIZE,
      phoneIds: sequence.phoneIds.filter((id) => id !== CTC_BLANK),
    });
  const frame = HOP_SIZE / request.sampleRate;
  return found ? { begin: found.first * frame, end: found.end * frame } : null;
}

// -- Exports ------------------------------------------------------------------

export { ctcSpan, findLine, isLineFinder, lineFeeds, linesAround };
