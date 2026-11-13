import type { LyricCommand } from "@/domain/commands/command";
import { withLineUpdates } from "@/domain/commands/line-edits";
import { applied, refused } from "@/domain/commands/outcome";
import { applyWordCountChange } from "@/domain/commands/word-edits";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import { withAlignedWords } from "@/domain/language/align";
import { manualBackgroundWordEdit } from "@/domain/line/background";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { type TrackField, trackField } from "@/domain/line/tracks";
import type { SyllableAddress } from "@/domain/selection/model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { copyMergeCover, mergeWordRun } from "@/domain/word/merge-run";
import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type MergeResolution = "apply" | "detach";

interface MergePlan {
  source: LyricLine;
  field: TrackField;
  sourceUpdate: LineUpdate;
  copies: { line: LyricLine; cover: ReturnType<typeof copyMergeCover> }[];
  // Linked copies whose blocks cross the merged text and must widen to follow it.
  crossing: number;
}

// -- Helpers ------------------------------------------------------------------

function mergedFieldUpdate(line: LyricLine, field: TrackField, indices: number[]): LineUpdate | null {
  const words = withAlignedWords(line)[field];
  const merged = words && mergeWordRun(words, indices);
  if (!merged) return null;
  return { id: line.id, updates: field === "backgroundWords" ? manualBackgroundWordEdit(merged) : { words: merged } };
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
    const words = withAlignedWords(line)[field];
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
  const sourceWords = withAlignedWords(source)[field];
  const sourceUpdate = mergedFieldUpdate(source, field, indices);
  if (!sourceWords || !sourceUpdate) return null;
  const covers = linkedCopyCovers(lines, source, sourceWords, field, indices);
  const crossing = covers.filter(({ cover }) => cover.inside.length !== cover.overlapping.length).length;
  return { source, field, sourceUpdate, copies: covers, crossing };
}

// -- Commands -----------------------------------------------------------------

// "apply" widens every linked copy to follow the merge; "detach" merges this line alone and unlinks it.
function mergeWords(addresses: readonly SyllableAddress[], resolution: MergeResolution): LyricCommand {
  return {
    note: { command: "merge words", args: [resolution, ...addresses.map((address) => address.syllableId)] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root, ctx) => {
      const plan = planMerge(root.lines, addresses);
      if (!plan) return addresses[0] ? refused({ reason: "word-gone", address: addresses[0] }) : applied(root, []);
      const { source, field, sourceUpdate } = plan;
      if (resolution === "detach") {
        const extras = field === "backgroundWords" ? sourceUpdate.updates : {};
        return applyWordCountChange(source.id, sourceUpdate.updates[field] ?? [], field, "detach", extras).run(
          root,
          ctx,
        );
      }
      const copyUpdates = plan.copies.flatMap(
        ({ line, cover }) => mergedFieldUpdate(line, field, cover.overlapping) ?? [],
      );
      return withLineUpdates(root, [sourceUpdate, ...copyUpdates], false);
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { mergeWords, planMerge };
