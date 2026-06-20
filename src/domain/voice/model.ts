import type { WordTiming } from "@/domain/word/timing";

// -- Types --------------------------------------------------------------------

type UntimedVoice = { text: string };
type LineSyncedVoice = { text: string; begin: number; end: number };
type WordSyncedVoice = { text: string; words: WordTiming[] };

type Voice = UntimedVoice | LineSyncedVoice | WordSyncedVoice;

type BackgroundSource = "extraction" | "manual";
type BackgroundVoice = Voice & { source?: BackgroundSource };

// -- Exports ------------------------------------------------------------------

export type { Voice, BackgroundVoice, BackgroundSource, UntimedVoice, LineSyncedVoice, WordSyncedVoice };
