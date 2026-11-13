import type { LyricCommand } from "@/domain/commands/command";
import { withLineUpdates } from "@/domain/commands/line-edits";
import { applied, refused } from "@/domain/commands/outcome";
import { applyWordCountChange } from "@/domain/commands/word-edits";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { withAlignedWords } from "@/domain/language/align";
import { regroupedLanguages } from "@/domain/language/pieces";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { fieldRole, fieldWords, type TrackField, trackField } from "@/domain/line/track";
import { withFieldWords } from "@/domain/line/word-track-edits";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { copyMergeCover, mergeWordRun } from "@/domain/word/merge-run";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type MergeResolution = "apply" | "detach";

interface MergePlan {
  source: LyricLine;
  field: TrackField;
  sourceUpdate: MergedField;
  copies: { line: LyricLine; cover: ReturnType<typeof copyMergeCover> }[];
  // Linked copies whose blocks cross the merged text and must widen to follow it.
  crossingIds: string[];
}

// -- Helpers ------------------------------------------------------------------

interface MergedField {
  update: LineUpdate;
  words: WordTiming[];
}

function mergedFieldUpdate(line: LyricLine, field: TrackField, indices: number[]): MergedField | null {
  const aligned = withAlignedWords(line);
  const words = fieldWords(aligned, field);
  const merged = words && mergeWordRun(words, indices);
  if (!merged) return null;
  const languages = regroupedLanguages(line, aligned, fieldRole(field), words, merged);
  const { tracks } = withFieldWords(line, field, merged);
  return { update: { id: line.id, updates: { tracks, languages } }, words: merged };
}

function linkedCopyCovers(
  lines: readonly LyricLine[],
  source: LyricLine,
  sourceWords: WordTiming[],
  field: TrackField,
  indices: number[],
) {
  const scope = getLinkScope(source);
  return lines.flatMap((line) => {
    if (line.id === source.id || !isLinkedSibling(line, scope)) return [];
    const words = fieldWords(withAlignedWords(line), field);
    return words ? [{ line, cover: copyMergeCover(sourceWords, indices, words) }] : [];
  });
}

// -- Functions ----------------------------------------------------------------

// The addresses name one run of words on one track of one line.
function planMerge(lines: readonly LyricLine[], addresses: readonly SyllableAddress[]): MergePlan | null {
  const resolved = resolveAddresses(lines, addresses);
  if (resolved.length === 0 || resolved.length !== addresses.length) return null;
  const source = lines[resolved[0].lineIndex];
  const field = trackField(resolved[0].type);
  const indices = resolved.map((word) => word.wordIndex);
  const sourceWords = fieldWords(withAlignedWords(source), field);
  const sourceUpdate = mergedFieldUpdate(source, field, indices);
  if (!sourceWords || !sourceUpdate) return null;
  const covers = linkedCopyCovers(lines, source, sourceWords, field, indices);
  const crossingIds = covers.flatMap(({ line, cover }) =>
    cover.inside.length !== cover.overlapping.length ? [line.id] : [],
  );
  return { source, field, sourceUpdate, copies: covers, crossingIds };
}

// -- Commands -----------------------------------------------------------------

// "apply" widens every linked copy to follow the merge; "detach" merges this line alone and unlinks it.
// `confirmedCrossing` is the crossing count the user answered; more copies crossing by commit time means they never agreed to widen them.
function mergeWords(
  addresses: readonly SyllableAddress[],
  resolution: MergeResolution,
  confirmedCrossing: number,
): LyricCommand {
  return {
    note: { command: "merge words", args: [resolution, ...addresses.map((address) => address.syllableId)] },
    copiesSharedTiming: true,
    run: (root, ctx) => {
      const plan = planMerge(root.lines, addresses);
      if (!plan) return addresses[0] ? refused({ reason: "word-gone", address: addresses[0] }) : applied(root, []);
      const { source, field, sourceUpdate } = plan;
      if (resolution === "detach") {
        const extras = { languages: sourceUpdate.update.updates.languages };
        return applyWordCountChange(source.id, sourceUpdate.words, field, "detach", extras).run(root, ctx);
      }
      if (plan.crossingIds.length > confirmedCrossing) {
        return refused({ reason: "needs-detach-confirm", impacted: plan.crossingIds });
      }
      const copyUpdates = plan.copies.flatMap(
        ({ line, cover }) => mergedFieldUpdate(line, field, cover.overlapping)?.update ?? [],
      );
      return withLineUpdates(root, [sourceUpdate.update, ...copyUpdates], false);
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { mergeWords, planMerge };
