import type { SavedSpan, SavedSyllable, SavedTrack } from "insync/saved-line";
import type { LanguageTextVariant } from "@/domain/language/display";
import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "insync/line";
import { lineFromSaved } from "@/domain/line/saved-line";
import { hasAnyTiming, hasMainLyrics, isWordSynced } from "insync/line-predicates";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import { normalizeLoadedMetadata } from "insync/project-normalize-metadata";
import type { ResumePosition } from "@/domain/project/resume-position";
import type { ProjectTab } from "@/domain/project/tab";
import { readUnisonLyricId } from "@/domain/unison/lyric-id";
import { type SpacedWord, wordsFromSpaced } from "insync/word-spaced-words";
import type { WordTiming } from "insync/word-timing";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

type ProjectAudioKind = "none" | "file" | "youtube";

interface ProjectIndexEntry {
  id: string;
  title: string;
  artists: string[];
  album: string;
  thumbnailDataUrl?: string;
  videoId?: string;
  audioFileName?: string;
  lineCount: number;
  syncedLineCount: number;
  hasWordTiming: boolean;
  audioKind: ProjectAudioKind;
  storedAudioBytes: number;
  storedStemBytes?: number;
  recordBytes?: number;
  updatedAt: number;
  openedAt?: number;
  lastTab?: ProjectTab;
  resumePosition?: ResumePosition;
  textVariant?: LanguageTextVariant;
  unisonLyricId?: string;
}

interface IndexEntryInput {
  id: string;
  metadata: Parameters<typeof normalizeLoadedMetadata>[0];
  lines: unknown;
  audioSource: SavedAudioSource | undefined;
  storedAudioBytes: number;
  storedStemBytes?: number;
  recordBytes?: number;
  updatedAt: number;
  openedAt?: number;
  lastTab?: ProjectTab;
  resumePosition?: ResumePosition;
  textVariant?: LanguageTextVariant;
  unisonLyricId?: unknown;
}

// -- Derivation ---------------------------------------------------------------

function isStoredLine(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredLyricLine(line: Record<string, unknown>): boolean {
  return typeof line.text === "string";
}

function isFormat4Line(line: Record<string, unknown>): line is Record<string, unknown> & { tracks: unknown[] } {
  return typeof line.id === "string" && Array.isArray(line.tracks);
}

// Saved words spell their trailing space in the text, so they are read the way a load reads them.
function isStoredWord(word: unknown): word is SpacedWord {
  return typeof word === "object" && word !== null && typeof (word as { text?: unknown }).text === "string";
}

// A malformed saved word counts as no word: the index never throws on a record it can list.
function storedWords(words: unknown): WordTiming[] | undefined {
  return Array.isArray(words) ? wordsFromSpaced(words.filter(isStoredWord)) : undefined;
}

const isSpan = (value: unknown): value is SavedSpan =>
  Array.isArray(value) && value.length === 2 && value.every((time) => typeof time === "number");

function isSavedSyllable(value: unknown): value is SavedSyllable {
  if (!isStoredLine(value)) return false;
  return (
    typeof value.text === "string" && typeof value.sep === "string" && (value.span === undefined || isSpan(value.span))
  );
}

// Only what the counts read: a malformed format 4 track or syllable counts as none, as a malformed saved word does.
function format4Line(line: Record<string, unknown> & { tracks: unknown[] }): LyricLine {
  const tracks = line.tracks.filter(isStoredLine).flatMap((track): SavedTrack[] => {
    const { role, syllables, span } = track;
    if (!Array.isArray(syllables) || (role !== "main" && role !== "bg")) return [];
    return [{ role, syllables: syllables.filter(isSavedSyllable), ...(isSpan(span) && { span }) }];
  });
  return lineFromSaved({ id: String(line.id), tracks });
}

function normalizeStoredLines(lines: unknown): LyricLine[] {
  const entries = (Array.isArray(lines) ? lines : []).filter(isStoredLine);
  const format4 = entries.filter(isFormat4Line).map(format4Line);
  const records = entries.filter(isStoredLyricLine) as unknown as LineFields[];
  const format3 = records.map((record) =>
    lineFromFields(
      {
        ...record,
        words: storedWords(record.words),
        backgroundWords: storedWords(record.backgroundWords),
      },
      getSplitCharacter(),
    ),
  );
  return [...format4, ...format3].filter((value) => hasMainLyrics(value, getSplitCharacter()));
}

function buildIndexEntry(input: IndexEntryInput): ProjectIndexEntry {
  const metadata = normalizeLoadedMetadata(input.metadata);
  const lyricLines = normalizeStoredLines(input.lines);
  const unisonLyricId = readUnisonLyricId(input.unisonLyricId);
  return {
    id: input.id,
    title: metadata.title,
    artists: metadata.artists,
    album: metadata.album,
    ...(metadata.thumbnailDataUrl ? { thumbnailDataUrl: metadata.thumbnailDataUrl } : {}),
    ...(input.audioSource?.kind === "youtube" ? { videoId: input.audioSource.videoId } : {}),
    ...(input.audioSource?.kind === "file" && input.audioSource.name ? { audioFileName: input.audioSource.name } : {}),
    lineCount: lyricLines.length,
    syncedLineCount: lyricLines.filter(hasAnyTiming).length,
    hasWordTiming: lyricLines.some(isWordSynced),
    audioKind: input.audioSource?.kind ?? "none",
    storedAudioBytes: input.storedAudioBytes,
    ...(input.storedStemBytes ? { storedStemBytes: input.storedStemBytes } : {}),
    ...(input.recordBytes !== undefined ? { recordBytes: input.recordBytes } : {}),
    updatedAt: input.updatedAt,
    ...(input.openedAt !== undefined ? { openedAt: input.openedAt } : {}),
    ...(input.lastTab ? { lastTab: input.lastTab } : {}),
    ...(input.resumePosition ? { resumePosition: input.resumePosition } : {}),
    ...(input.textVariant ? { textVariant: input.textVariant } : {}),
    ...(unisonLyricId ? { unisonLyricId } : {}),
  };
}

// -- Exports ------------------------------------------------------------------

export { buildIndexEntry };
export type { IndexEntryInput, ProjectIndexEntry };
