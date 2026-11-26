import type { LyricLine } from "@/domain/line/model";
import { drawnSyllables } from "@/domain/line/drawn-track";
import { backgroundText, lineText } from "@/domain/line/text";
import { trackRole, untimedSyllablesOf } from "@/domain/line/track";
import type { SyncAddress } from "@/domain/sync/address";
import type { AnchorUndo } from "@/domain/sync/anchor-gesture";
import type { ReRecording } from "@/domain/sync/skipped-instances";
import { wordsFromSpaced } from "@/domain/word/spaced-words";
import { textParts } from "@/domain/word/text-parts";
import type { WordTiming } from "@/domain/word/timing";
import { useSettingsStore } from "@/stores/settings";
import { formatTime } from "@/utils/format-time";
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

function splitIntoWords(text: string): string[] {
  return splitIntoWordsWithMeta(text).parts;
}

function splitIntoWordsWithMeta(
  text: string,
  char = getSplitCharacter(),
): { parts: string[]; trailingSpace: boolean[] } {
  const parts = textParts(text, char);
  return {
    parts: parts.map((part) => part.text),
    trailingSpace: parts.map((part, index) => part.sep !== "" && index < parts.length - 1),
  };
}

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

// -- Conversion Functions -----------------------------------------------------

// Evenly timed parts of a text, as a line-synced line's span becomes words.
function evenlyTimedWords(text: string, begin: number, end: number): WordTiming[] {
  const { parts, trailingSpace } = splitIntoWordsWithMeta(text);
  const wordDuration = (end - begin) / parts.length;
  return wordsFromSpaced(
    parts.map((part, i) => ({
      text: trailingSpace[i] ? `${part} ` : part,
      begin: begin + i * wordDuration,
      end: begin + (i + 1) * wordDuration,
    })),
  );
}

// -- Word Distribution --------------------------------------------------------

const DEFAULT_BG_WORD_DURATION = 0.3;

function distributeWordsInLine(text: string, begin: number, end: number): WordTiming[] {
  const { parts: words, trailingSpace } = splitIntoWordsWithMeta(text);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const duration = end - begin;

  let currentTime = begin;
  return wordsFromSpaced(
    words.map((word, i) => {
      const wordDuration = (word.length / totalChars) * duration;
      const wordTiming = {
        text: trailingSpace[i] ? `${word} ` : word,
        begin: currentTime,
        end: currentTime + wordDuration,
      };
      currentTime += wordDuration;
      return wordTiming;
    }),
  );
}

// -- BG Word Creation ---------------------------------------------------------

function createInitialBgWords(backgroundText: string, begin: number, end?: number): WordTiming[] {
  const wordCount = splitIntoWords(backgroundText).length;
  if (wordCount === 0) return [];
  const resolvedEnd = end ?? begin + wordCount * DEFAULT_BG_WORD_DURATION;
  return distributeWordsInLine(backgroundText, begin, resolvedEnd);
}

function createTrackWordsFromTextAt(
  line: LyricLine,
  type: "word" | "bg",
  begin: number,
  maxEnd: number,
): WordTiming[] | null {
  const text = type === "word" ? lineText(line) : backgroundText(line);
  if (!text || drawnSyllables(line, trackRole(type)).length > 0) return null;
  const partDuration = type === "word" ? useSettingsStore.getState().defaultWordDuration : DEFAULT_BG_WORD_DURATION;
  const naturalEnd = begin + splitIntoWords(text).length * partDuration;
  const words = distributeWordsInLine(text, begin, Math.min(maxEnd, naturalEnd));
  if (words.length === 0) return null;
  // The text's own syllables are timed in place, so they keep their ids and readings.
  const untimed = untimedSyllablesOf(line, type === "word" ? "main" : "bg");
  if (untimed.length !== words.length) return words;
  return words.map((word, index) => ({ ...untimed[index], begin: word.begin, end: word.end }));
}

// -- Exports ------------------------------------------------------------------

export {
  createTrackWordsFromTextAt,
  createInitialBgWords,
  distributeWordsInLine,
  getNudgeAmount,
  evenlyTimedWords,
  formatTimeMs,
  parseTimeMs,
  splitIntoWords,
  splitIntoWordsWithMeta,
};
export type { SyncReRecording, SyncState };
