import type { LanguageTextVariant } from "@/domain/language/display";
import { type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LyricLine } from "@/domain/line/model";
import { hasAnyTiming, hasMainLyrics, isWordSynced } from "@/domain/line/predicates";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import type { ResumePosition } from "@/domain/project/resume-position";
import type { ProjectTab } from "@/domain/project/tab";
import { readUnisonLyricId } from "@/domain/unison/lyric-id";
import { wordsFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";

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

// Saved words spell their trailing space in the text, so they are read the way a load reads them.
function storedWords(words: unknown): WordTiming[] | undefined {
  return Array.isArray(words) ? wordsFromSpaced(words) : undefined;
}

function normalizeStoredLines(lines: unknown): LyricLine[] {
  const entries = Array.isArray(lines) ? lines : [];
  const records = entries.filter(isStoredLine).filter(isStoredLyricLine) as unknown as LineFields[];
  return records
    .map((record) =>
      lineFromFields({
        ...record,
        words: storedWords(record.words),
        backgroundWords: storedWords(record.backgroundWords),
      }),
    )
    .filter(hasMainLyrics);
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
