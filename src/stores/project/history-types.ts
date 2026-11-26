import type { Agent } from "@/domain/agent/model";
import type { HistoryNote, LyricCommand } from "@/domain/commands/command";
import type { Outcome } from "@/domain/commands/outcome";
import type { LinkGroup } from "@/domain/group/template";
import type { LyricLine } from "@/domain/line/model";
import type { SnapPoint } from "@/domain/snap-point/model";
import type { BeatGrid } from "@/domain/tempo/beat-grid";

// -- Types --------------------------------------------------------------------

// "pending" joins a typing burst that the next step or undo records; "amend" joins the current step.
type CommitMode = "step" | "pending" | "amend";

interface HistoryEntry {
  lines: LyricLine[];
  groups: LinkGroup[];
  agents: Agent[];
  customSnapPoints: SnapPoint[];
  beatGrid: BeatGrid | null;
  timestamp: number;
  note: HistoryNote | null;
}

interface HistoryState {
  isDirty: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  // True when any snapshotted state (lines, groups, agents) has changed since
  // the last history entry was written (e.g., per-keystroke "pending" commits from the
  // Edit textarea). The next history-aware mutator, and undo itself, snapshot
  // this state first so undo lands on the pending edit instead of skipping it.
  isDirtySinceHistory: boolean;
  pendingNote: HistoryNote | null;
}

// The lyrics a typing burst started from, and whether an earlier write was still pending then.
interface LyricBurst {
  lines: LyricLine[];
  wasPending: boolean;
}

interface HistoryActions {
  commit: (command: LyricCommand, mode?: CommitMode) => Outcome;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  markDirty: () => void;
  markClean: () => void;
  beginLyricBurst: () => LyricBurst;
  closeLyricBurst: (burst: LyricBurst) => void;
  isCurrentStep: (entry: HistoryEntry | undefined) => boolean;
}

// -- Exports ------------------------------------------------------------------

export type { CommitMode, HistoryActions, HistoryEntry, HistoryState, LyricBurst };
