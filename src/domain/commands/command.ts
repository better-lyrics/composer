import type { LyricRoot, Outcome } from "@/domain/commands/outcome";

// -- Types --------------------------------------------------------------------

interface CommandContext {
  splitChar: string;
  shareTimingInNewGroups: boolean;
  newId: () => string;
}

// Internal only: undo never reads it.
interface HistoryNote {
  command: string;
  args: readonly (string | number)[];
}

interface LyricCommand {
  note: HistoryNote;
  derivesText: boolean;
  copiesSharedTiming: boolean;
  run: (root: LyricRoot, ctx: CommandContext) => Outcome;
  afterSharedCopy?: (root: LyricRoot, ctx: CommandContext) => Outcome;
}

// -- Exports ------------------------------------------------------------------

export type { CommandContext, HistoryNote, LyricCommand };
