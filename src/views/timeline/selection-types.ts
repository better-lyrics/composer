import type { WordTiming } from "@/stores/project";

// -- Types ---------------------------------------------------------------------

interface ClipboardEntry {
  word: WordTiming;
  lineOffset: number;
  trackType: "word" | "bg";
}

interface ClipboardData {
  entries: ClipboardEntry[];
}

type PasteMode = { status: "idle" } | { status: "preview"; clipboard: ClipboardData };

// -- Exports -------------------------------------------------------------------

export type { ClipboardEntry, ClipboardData, PasteMode };
