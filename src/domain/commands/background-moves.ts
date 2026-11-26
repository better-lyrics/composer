import type { LyricCommand } from "@/domain/commands/command";
import { type LyricRoot, type Outcome, applied, withLines } from "@/domain/commands/outcome";
import { getLinkScope, isLinkedSibling } from "@/domain/group/linking";
import type { LyricLine } from "@/domain/line/model";
import { applyMoveFromBg, applyMoveToBg } from "@/domain/line/word-track-edits";
import { expandSelectionToGroupmates } from "@/domain/word/syllable-groups";

// -- Types --------------------------------------------------------------------

type TrackField = "words" | "backgroundWords";

interface MoveArgs {
  lineId: string;
  wordIndices: number[];
  timeDelta: number;
  duration: number;
}

type MoveWords = (line: LyricLine, wordIndices: number[], timeDelta: number, duration: number) => LyricLine | null;

// -- Helpers ------------------------------------------------------------------

function moveAcrossTracks(
  root: LyricRoot,
  from: TrackField,
  move: MoveWords,
  { lineId, wordIndices, timeDelta, duration }: MoveArgs,
): Outcome {
  const sourceLine = root.lines.find((line) => line.id === lineId);
  const sourceWords = sourceLine?.[from];
  if (!sourceLine || !sourceWords || wordIndices.length === 0) return applied(root, []);
  const sourceCount = sourceWords.length;
  const linkScope = getLinkScope(sourceLine);

  let mutated = false;
  const lines = root.lines.map((line) => {
    const isSource = line.id === lineId;
    const isSibling = !isSource && isLinkedSibling(line, linkScope) && line[from]?.length === sourceCount;
    if (!isSource && !isSibling) return line;
    const expanded = expandSelectionToGroupmates(line[from] ?? [], wordIndices);
    const updated = move(line, expanded, timeDelta, duration);
    if (!updated) return line;
    mutated = true;
    return updated;
  });
  return withLines(root, mutated ? lines : null);
}

// -- Commands -----------------------------------------------------------------

function moveWordsToBackground(args: MoveArgs): LyricCommand {
  return {
    note: { command: "move to background", args: [args.lineId, ...args.wordIndices] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => moveAcrossTracks(root, "words", applyMoveToBg, args),
  };
}

function moveWordsFromBackground(args: MoveArgs): LyricCommand {
  return {
    note: { command: "move from background", args: [args.lineId, ...args.wordIndices] },
    derivesText: true,
    copiesSharedTiming: true,
    run: (root) => moveAcrossTracks(root, "backgroundWords", applyMoveFromBg, args),
  };
}

// -- Exports ------------------------------------------------------------------

export { moveWordsFromBackground, moveWordsToBackground };
