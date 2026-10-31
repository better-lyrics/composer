import { ctcChunks, ctcClasses, songFrames, writeChunkLogProbs } from "@/audio/alignment/hubertfa/ctc-song";
import { CTC_BLANK, type CtcEmissions, ctcViterbi } from "@/audio/alignment/hubertfa/ctc-viterbi";
import type { G2pResult } from "@/audio/alignment/hubertfa/g2p";
import { buildPhoneSequence } from "@/audio/alignment/hubertfa/sequence";
import type { DraftLineRequest } from "@/audio/alignment/types";
import { type DraftPlacement, draftSegments, placeDraftLine } from "@/domain/alignment/draft-timing";

// The worker's half of drafting line timings: the CTC pass over the song and
// the Viterbi placement of every line between the user's pins.

// -- Types --------------------------------------------------------------------

interface DraftDeps {
  samples: Float32Array;
  sampleRate: number;
  hopSize: number;
  /** A line's phone ids, silences left out. */
  phonesOf: (line: DraftLineRequest) => Promise<Int32Array>;
  /** Runs the model on a stretch of audio; resolves to its `ctc_logits`, [1, vocab, frames], if it has them. */
  run: (samples: Float32Array) => Promise<{ data: Float32Array; dims: readonly number[] } | undefined>;
  onProgress: (done: number, total: number) => void;
  isCancelled: () => boolean;
}

// -- Functions ----------------------------------------------------------------

// The phones the CTC places a line by: its forced sequence without the silences.
// Every silence-class phone has vocab id 0, which is the CTC blank.
function draftPhones(g2p: G2pResult): Int32Array {
  if (g2p.kind === "unknown") return new Int32Array();
  const built = buildPhoneSequence(g2p.units);
  if (built.kind !== "sequence") return new Int32Array();
  return built.sequence.phoneIds.filter((id) => id !== CTC_BLANK);
}

/**
 * Per line, its CTC placement, or null for pins and lines it couldn't place.
 * Null overall when cancelled. Chunks that no gap needs aren't run.
 */
async function draftLines(
  lines: readonly DraftLineRequest[],
  deps: DraftDeps,
): Promise<(DraftPlacement | null)[] | null> {
  const { samples, sampleRate, hopSize } = deps;
  const phones: Int32Array[] = [];
  // react-doctor-disable-next-line react-doctor/async-await-in-loop -- pinyin loads once, on the first Mandarin line
  for (const line of lines) phones.push(await deps.phonesOf(line));
  const frameSeconds = hopSize / sampleRate;
  const frames = songFrames(samples.length, hopSize);
  const segments = draftSegments(
    lines.map((line, i) => ({ pin: line.pin, phones: phones[i].length })),
    samples.length / sampleRate,
  ).map((s) => ({
    ...s,
    from: Math.max(0, Math.floor(s.begin / frameSeconds)),
    to: Math.min(frames, Math.ceil(s.end / frameSeconds)),
  }));
  const chunks = ctcChunks(frames, frameSeconds).filter((c) =>
    segments.some((s) => c.keepFrom < s.to && s.from < c.keepTo),
  );
  // The whole song's phones, as in the study whose confidence thresholds the review uses.
  const classIds = ctcClasses(phones.flatMap((p) => [...p]));
  const classOf = new Map(Array.from(classIds, (id, c) => [id, c]));
  const emissions: CtcEmissions = {
    logProbs: new Float32Array(frames * classIds.length),
    frames,
    classes: classIds.length,
  };
  for (const [done, chunk] of chunks.entries()) {
    if (deps.isCancelled()) return null;
    deps.onProgress(done, chunks.length);
    const audio = samples.subarray(chunk.start * hopSize, (chunk.start + chunk.frames) * hopSize);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one model run at a time, with progress and cancel between chunks
    const logits = await deps.run(audio);
    if (!logits) throw new Error("This alignment model has no CTC output, so it can't draft line timings.");
    writeChunkLogProbs(emissions, classIds, chunk, logits.data, logits.dims[2]);
  }
  deps.onProgress(chunks.length, chunks.length);

  const placements: (DraftPlacement | null)[] = phones.map(() => null);
  for (const segment of segments) {
    const tokens = Int32Array.from(segment.lines.flatMap((i) => [...phones[i]].map((id) => classOf.get(id)!)));
    const spans = ctcViterbi(emissions, tokens, segment.from, segment.to);
    if (!spans) continue;
    let k = 0;
    for (const i of segment.lines) {
      placements[i] = placeDraftLine(spans.slice(k, k + phones[i].length), frameSeconds);
      k += phones[i].length;
    }
  }
  return placements;
}

// -- Exports ------------------------------------------------------------------

export { draftLines, draftPhones };
