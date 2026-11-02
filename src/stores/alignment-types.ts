import type { LyricLine } from "@/domain/line/model";

// The alignment store's state, its actions and what a run reports.

// -- Types --------------------------------------------------------------------

type AlignmentStatus = "idle" | "downloading" | "running" | "error";

type AlignmentErrorCode = "unavailable" | "unsupported-language" | "needs-vocals" | "needs-model" | "failed";

interface AlignmentError {
  code: AlignmentErrorCode;
  message: string;
}

interface AlignmentResult {
  aligned: number;
  /** Lines edited while alignment ran; their new timing was not applied. */
  skipped: number;
  /** Lines the model couldn't place, split by character count instead. */
  fellBack: number;
  /** Words with no known pronunciation; their lines fell back. */
  unknownWords: string[];
  /** Words aligned on a pronunciation guessed from their spelling. */
  guessedWords: string[];
}

interface AlignOptions {
  /** Permission to download the alignment model if it isn't cached yet. */
  allowDownload?: boolean;
  /** Also redo lines that already have word timing, using their current span as the guide. */
  realign?: boolean;
}

interface AlignmentState {
  status: AlignmentStatus;
  progress: { done: number; total: number };
  error: AlignmentError | null;
  modelCached: boolean;
  /** Download size of the selected model and its dictionary, once resolved. */
  modelSizeBytes: number | null;
}

interface AlignmentActions {
  /** Aligns the given lines, or every eligible line when omitted. */
  alignLines: (lineIds?: readonly string[], options?: AlignOptions) => Promise<AlignmentResult | null>;
  cancel: () => void;
  dismissError: () => void;
  refreshModelCached: (modelId?: string) => Promise<void>;
  /**
   * Times the syllables of words split since `before`, when the model is
   * already loaded. Only the boundaries inside each split word move.
   */
  retimeNewSyllables: (before: readonly LyricLine[]) => Promise<void>;
}

// -- Exports ------------------------------------------------------------------

export type { AlignmentActions, AlignmentError, AlignmentErrorCode, AlignmentState };
