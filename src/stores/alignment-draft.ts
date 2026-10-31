import type { DraftLineRequest } from "@/audio/alignment/types";
import { sungTransliteration } from "@/domain/alignment/transliteration";
import { type DraftMark, type ReviewedPlacement, draftRoles, reviewDraft } from "@/domain/alignment/draft-timing";
import { groupAlignmentWords, type WordInterval } from "@/domain/alignment/words";
import type { LyricLine } from "@/domain/line/model";
import { type ReadyRun, alignPlanned, applyAligned } from "@/stores/alignment-run";
import { type PlannedLine, planDraftLine } from "@/stores/alignment-plan";
import { useDraftReviewStore } from "@/stores/draft-review";
import { useProjectStore } from "@/stores/project";
import { firstBegin } from "@/domain/word/bounds";
import { splitIntoWordsWithMeta } from "@/utils/sync-helpers";

// Drafts line timings without taps: the CTC head places every line the user
// hasn't timed, between the ones they have, then each placed line is aligned
// word by word as if it had been tapped there. One undo takes it all back.

// -- Types --------------------------------------------------------------------

interface DraftResult {
  placed: number;
  /** Placed lines worth the user's check. */
  flagged: number;
  /** Lines the draft couldn't place; they stay untimed. */
  unplaced: number;
  /** Lines edited while the draft ran; their new timing was not applied. */
  skipped: number;
  /** The whole song placed poorly: tapping will beat reviewing. */
  lowConfidence: boolean;
  /** Song time of the first flagged line, to start the review at. */
  firstFlagged: number | null;
  unknownWords: string[];
  guessedWords: string[];
}

type DraftPhase = "placing" | "aligning";

// -- Functions ----------------------------------------------------------------

function requestLine(line: LyricLine, pin: WordInterval | null): DraftLineRequest {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(line.text);
  const words = groupAlignmentWords(parts, trailingSpace).map((word) => word.parts);
  return { words, transliteration: sungTransliteration(line), pin };
}

// Each placed line's plan; a line's window starts no earlier than the end of the timing before it.
function planPlaced(
  lines: readonly LyricLine[],
  placed: ReadonlyMap<number, ReviewedPlacement>,
  pins: readonly (WordInterval | null)[],
) {
  const planned: { plan: PlannedLine; placement: ReviewedPlacement }[] = [];
  let previous: WordInterval | null = null;
  lines.forEach((line, i) => {
    const placement = placed.get(i);
    const plan = placement && planDraftLine(line, placement, previous);
    if (plan) planned.push({ plan, placement });
    previous = plan?.taps ?? pins[i] ?? previous;
  });
  return planned;
}

async function draftTimings(
  run: ReadyRun,
  signal: AbortSignal,
  report: (phase: DraftPhase, done: number, total: number) => void,
): Promise<DraftResult> {
  const project = useProjectStore.getState();
  const roles = draftRoles(project.lines, useDraftReviewStore.getState().marks);
  const included = project.lines.flatMap((line, i) => (roles[i].kind === "skip" ? [] : [{ line, role: roles[i] }]));
  const pins = included.map(({ role }) => (role.kind === "pin" ? role.bounds : null));
  const placements = await run.aligner.draft(
    {
      lines: included.map(({ line }, i) => requestLine(line, pins[i])),
      hanReading: run.hanReading,
      samples: run.pcm.samples,
      sampleRate: run.pcm.sampleRate,
    },
    (done, total) => report("placing", done, total),
    signal,
  );
  const toPlace = included.flatMap((_, i) => (pins[i] ? [] : [i]));
  const review = reviewDraft(toPlace.map((i) => placements[i]));
  const placed = new Map(toPlace.flatMap((i, k) => (review.lines[k] ? [[i, review.lines[k]] as const] : [])));
  const planned = planPlaced(
    included.map(({ line }) => line),
    placed,
    pins,
  );
  const plans = planned.map(({ plan }) => plan);
  report("aligning", 0, plans.length);
  const aligned = await alignPlanned(run, plans, signal, (done) => report("aligning", done, plans.length));
  const applied = applyAligned(
    project.projectSession,
    aligned.updates,
    (current, id) => current === aligned.plannedById.get(id)?.line,
    signal,
  );

  const placementOf = new Map(planned.map(({ plan, placement }) => [plan.line.id, placement]));
  const byId = new Map(useProjectStore.getState().lines.map((l) => [l.id, l]));
  const marks: Record<string, DraftMark> = { ...useDraftReviewStore.getState().marks };
  let firstFlagged: number | null = null;
  let flagged = 0;
  for (const { id } of applied) {
    const placement = placementOf.get(id)!;
    const words = byId.get(id)?.words;
    if (!words) continue;
    // A line the aligner split evenly is worth a look whatever the CTC made of it.
    const mark = { words, confidence: placement.confidence, flagged: placement.flagged || aligned.fellBack.has(id) };
    marks[id] = mark;
    if (!mark.flagged) continue;
    flagged++;
    firstFlagged ??= firstBegin(words);
  }
  useDraftReviewStore.setState({ marks, lowConfidence: review.lowConfidence });
  return {
    placed: applied.length,
    flagged,
    unplaced: toPlace.length - placed.size,
    skipped: aligned.updates.length - applied.length,
    lowConfidence: review.lowConfidence,
    firstFlagged,
    unknownWords: [...aligned.unknownWords],
    guessedWords: [...aligned.guessedWords],
  };
}

// -- Exports ------------------------------------------------------------------

export { draftTimings };
export type { DraftPhase, DraftResult };
