import type { LyricLine } from "@/domain/line/model";
import { hasAnyTiming, hasMainLyrics, isWordSynced } from "@/domain/line/predicates";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import type { ProjectTab } from "@/domain/project/tab";

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
  recordBytes?: number;
  updatedAt: number;
  openedAt?: number;
  lastTab?: ProjectTab;
}

interface IndexEntryInput {
  id: string;
  metadata: Parameters<typeof normalizeLoadedMetadata>[0];
  lines: unknown;
  audioSource: SavedAudioSource | undefined;
  storedAudioBytes: number;
  recordBytes?: number;
  updatedAt: number;
  openedAt?: number;
  lastTab?: ProjectTab;
}

// -- Derivation ---------------------------------------------------------------

function isStoredLine(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStoredMainLyrics(line: Record<string, unknown>): boolean {
  return typeof line.text === "string" && hasMainLyrics(line as unknown as LyricLine);
}

function normalizeStoredLines(lines: unknown): LyricLine[] {
  const entries = Array.isArray(lines) ? lines : [];
  return entries.filter(isStoredLine).filter(hasStoredMainLyrics) as unknown as LyricLine[];
}

function buildIndexEntry(input: IndexEntryInput): ProjectIndexEntry {
  const metadata = normalizeLoadedMetadata(input.metadata);
  const lyricLines = normalizeStoredLines(input.lines);
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
    ...(input.recordBytes !== undefined ? { recordBytes: input.recordBytes } : {}),
    updatedAt: input.updatedAt,
    ...(input.openedAt !== undefined ? { openedAt: input.openedAt } : {}),
    ...(input.lastTab ? { lastTab: input.lastTab } : {}),
  };
}

// -- Exports ------------------------------------------------------------------

export { buildIndexEntry };
export type { IndexEntryInput, ProjectIndexEntry };
