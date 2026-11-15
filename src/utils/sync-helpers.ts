import type { LyricLine } from "insync/line";
import { drawnSyllables } from "insync/line-drawn-track";
import { backgroundText, lineText } from "insync/line-text";
import { trackRole, untimedSyllablesOf } from "insync/line-track";
import type { SyncAddress } from "@/domain/sync/address";
import type { AnchorUndo } from "@/domain/sync/anchor-gesture";
import type { ReRecording } from "@/domain/sync/skipped-instances";
import type { WordTiming } from "insync/word-timing";
import { useSettingsStore } from "@/stores/settings";
import { formatTime } from "insync/format-time";
import { DEFAULT_BG_WORD_DURATION, distributeWordsInLine, splitIntoWords } from "insync/lyric-words";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface SyncReRecording extends ReRecording {
  projectId: string | undefined;
}

interface SyncState {
  position: SyncAddress;
  isActive: boolean;
  // True when the cursor was placed by a jump rather than by advancing through
  // the song. Tapping the first word of a line closes the previous line so the
  // two meet, which is right in a forward pass but stretches an already-correct
  // line when the user jumped back to re-record this one.
  jumpedToPosition?: boolean;
  anchorUndo?: AnchorUndo;
  reRecording?: SyncReRecording;
}

// -- Constants ----------------------------------------------------------------

function getNudgeAmount(): number {
  return useSettingsStore.getState().nudgeAmount;
}

// -- Functions ----------------------------------------------------------------

const formatTimeMs = (seconds: number) => formatTime(seconds, 3);

function parseTimeMs(str: string): number | null {
  const trimmed = str.trim();
  // Format: M:SS.mmm or MM:SS.mmm
  const match = trimmed.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const mins = Number.parseInt(match[1], 10);
  const secs = Number.parseInt(match[2], 10);
  const ms = match[3] ? Number.parseInt(match[3].padEnd(3, "0"), 10) : 0;
  if (secs >= 60) return null;
  return mins * 60 + secs + ms / 1000;
}

// -- Word Creation ------------------------------------------------------------

function createTrackWordsFromTextAt(
  line: LyricLine,
  type: "word" | "bg",
  begin: number,
  maxEnd: number,
): WordTiming[] | null {
  const splitChar = getSplitCharacter();
  const text = type === "word" ? lineText(line, splitChar) : backgroundText(line, splitChar);
  if (!text || drawnSyllables(line, trackRole(type), splitChar).length > 0) return null;
  const partDuration = type === "word" ? useSettingsStore.getState().defaultWordDuration : DEFAULT_BG_WORD_DURATION;
  const naturalEnd = begin + splitIntoWords(text, splitChar).length * partDuration;
  const words = distributeWordsInLine(text, begin, Math.min(maxEnd, naturalEnd), splitChar);
  if (words.length === 0) return null;
  // The text's own syllables are timed in place, so they keep their ids and readings.
  const untimed = untimedSyllablesOf(line, type === "word" ? "main" : "bg");
  if (untimed.length !== words.length) return words;
  return words.map((word, index) => ({ ...untimed[index], begin: word.begin, end: word.end }));
}

// -- Exports ------------------------------------------------------------------

export { createTrackWordsFromTextAt, formatTimeMs, getNudgeAmount, parseTimeMs };
export type { SyncReRecording, SyncState };
