import { hubertfaAligner } from "@/audio/alignment/hubertfa/hubertfa-aligner";
import { areAlignmentAssetsCached, resolveAlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import type { Aligner } from "@/audio/alignment/types";
import { loadVocalsPcm } from "@/audio/alignment/vocals-pcm";
import { hasCjk } from "@/domain/alignment/cjk";
import { type HanReading, canAlignLanguage, hanReadingFor } from "@/domain/alignment/language";
import { retimeWords, sanitizeIntervals, timingsFromParts } from "@/domain/alignment/words";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { type PlannedLine, segmentFor } from "@/stores/alignment-plan";
import { useProjectStore } from "@/stores/project";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";

// What a whole-song run needs before it can align (the model, the vocals, the
// song's reading of Han characters) and the line-by-line alignment itself,
// shared by auto-align and drafting.

// -- Types --------------------------------------------------------------------

type RunFailure = {
  code: "unavailable" | "unsupported-language" | "needs-vocals" | "needs-model";
  message: string;
};

interface ReadyRun {
  aligner: Aligner;
  hanReading: HanReading;
  pcm: { samples: Float32Array; sampleRate: number };
}

interface AlignedLines {
  updates: LineUpdate[];
  plannedById: Map<string, PlannedLine>;
  /** Ids of the lines the model couldn't place, split by character count instead. */
  fellBack: Set<string>;
  unknownWords: Set<string>;
  guessedWords: Set<string>;
}

// -- Functions ----------------------------------------------------------------

/** Loads the selected model and the vocals for a run over `lines`, or says what's missing. */
async function prepareRun(
  lines: readonly LyricLine[],
  options: { allowDownload: boolean; signal: AbortSignal; onLoading: (loaded: number, total: number) => void },
): Promise<ReadyRun | RunFailure> {
  const aligner: Aligner = hubertfaAligner;
  const project = useProjectStore.getState();
  // One model for the whole run, even if the setting changes while it starts.
  const modelId = useSettingsStore.getState().alignmentModelId;
  const assets = await resolveAlignmentAssets(modelId);
  if (!assets) return { code: "unavailable", message: "Auto-align isn't available on this deployment." };
  if (!canAlignLanguage(project.metadata.language, assets.languages)) {
    return { code: "unsupported-language", message: "The alignment model doesn't cover this song's language." };
  }
  const hanReading = hanReadingFor(project.metadata.language, project.lines);
  const japanese = hanReading === "ja" && lines.some((line) => hasCjk(line.text));
  const vocalsUrl = useSeparationStore.getState().stemUrls.vocals;
  if (!vocalsUrl) {
    return {
      code: "needs-vocals",
      message: "Separate the vocals first. Alignment on the full mix is less accurate than tapping by hand.",
    };
  }
  if (!options.allowDownload && !(await areAlignmentAssetsCached(assets))) {
    return { code: "needs-model", message: "Auto-align needs a one-time model download." };
  }
  options.signal.throwIfAborted();
  await aligner.prepare(options.onLoading, options.signal, { japanese, modelId });
  return { aligner, hanReading, pcm: await loadVocalsPcm(vocalsUrl) };
}

/**
 * Writes the updates whose lines `isCurrent` still accepts, as one undo step,
 * and returns them. Throws an AbortError when another project has opened.
 */
function applyAligned(
  session: number,
  updates: readonly LineUpdate[],
  isCurrent: (line: LyricLine | undefined, id: string) => boolean,
  signal: AbortSignal,
): LineUpdate[] {
  signal.throwIfAborted();
  const latest = useProjectStore.getState();
  // Another project can share line ids and text (a duplicate, a re-import); this run's timing isn't its.
  if (latest.projectSession !== session) throw new DOMException("Project changed", "AbortError");
  const currentById = new Map(latest.lines.map((l) => [l.id, l]));
  const applicable = updates.filter((u) => isCurrent(currentById.get(u.id), u.id));
  if (applicable.length > 0) {
    // Timing only: deriving text would drop the untimed words of partly synced lines.
    latest.updateLinesWithHistory(applicable, { deriveText: false });
    // Lines are tapped in Line mode; once they have word timing, refine words.
    latest.setGranularity("word");
  }
  return applicable;
}

/** Word timing for each planned line, aligned inside the window around its line timing. */
async function alignPlanned(
  run: ReadyRun,
  planned: readonly PlannedLine[],
  signal: AbortSignal,
  onLine: (done: number) => void,
): Promise<AlignedLines> {
  const out: AlignedLines = {
    updates: [],
    plannedById: new Map(),
    fellBack: new Set(),
    unknownWords: new Set(),
    guessedWords: new Set(),
  };
  for (const plan of planned) {
    signal.throwIfAborted();
    const { line, words, existing } = plan;
    const { segment, window } = segmentFor(plan, run.hanReading, run.pcm);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- the worker aligns one line at a time, and progress and cancel follow each line
    const result = await run.aligner.align(segment, signal);
    if (result.fellBack) out.fellBack.add(line.id);
    for (const word of result.unknownWords) out.unknownWords.add(word);
    for (const word of result.guessedWords) out.guessedWords.add(word);
    const safe = sanitizeIntervals(result.intervals, window);
    const timings = existing ? retimeWords(existing, safe) : timingsFromParts(words, safe, result.splits);
    out.updates.push({ id: line.id, updates: { words: timings } });
    out.plannedById.set(line.id, plan);
    onLine(out.updates.length);
  }
  return out;
}

// -- Exports ------------------------------------------------------------------

export { alignPlanned, applyAligned, prepareRun };
export type { ReadyRun };
