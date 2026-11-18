import type { LanguagePiece } from "insync/language";
import type { LyricLine } from "insync/line";
import type { WordTiming } from "insync/word-timing";

// -- Types ---------------------------------------------------------------------

interface ClipboardEntry {
  word: WordTiming;
  lineOffset: number;
  trackType: "word" | "bg";
  piece?: LanguagePiece;
}

interface ClipboardData {
  entries: ClipboardEntry[];
  sourceInstance?: {
    groupId: string;
    instanceIdx: number;
  };
  candidateLines?: LyricLine[];
}

type PasteMode = { status: "idle" } | { status: "preview"; clipboard: ClipboardData };

// -- Exports -------------------------------------------------------------------

export type { ClipboardEntry, ClipboardData, PasteMode };
