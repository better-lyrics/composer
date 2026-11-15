import type { LyricRoot, Outcome } from "./outcome";

// -- Types --------------------------------------------------------------------

interface CommandContext {
  splitChar: string;
  shareTimingInNewGroups: boolean;
  newId: () => string;
  // Where the song ends, unbounded until the audio's length is known.
  songEnd: number;
}

// Internal only: undo never reads it.
interface HistoryNote {
  command: string;
  args: readonly (string | number)[];
}

interface LyricCommand {
  note: HistoryNote;
  copiesSharedTiming: boolean;
  // False when the copy belongs to a step that already announced it.
  announcesSharedCopy?: false;
  // The command writes every line as it should end up, so no edit reaches other instances through the template.
  writesEveryLine?: true;
  run: (root: LyricRoot, ctx: CommandContext) => Outcome;
  afterSharedCopy?: (root: LyricRoot, ctx: CommandContext) => Outcome;
}

// -- Exports ------------------------------------------------------------------

export type { CommandContext, HistoryNote, LyricCommand };
