import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import { type LineFields, type LyricLine, reconcileLine } from "@/domain/line/model";
import { withSplitMarksFromWords } from "@/domain/line/reconstruct-text";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import type { MetadataKey } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import type { SyllableSplitDefaults } from "@/domain/project/syllable-split-defaults";
import type { StoredData } from "@/domain/storage/stored-data";
import type { TimingGranularity } from "@/domain/project/timing-granularity";
import type { SnapPoint } from "@/domain/snap-point/model";
import { type SpacedWord, spacedFromWords, wordsFromSpaced } from "@/domain/word/spaced-words";
import type { WordTiming } from "@/domain/word/timing";
import type { GranularityMode } from "@/stores/project";
import type { TtmlEditState } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

// A line as saved in a version 3 record or link: words keep their separator inside `text`.
type SavedLine = Omit<LineFields, "backgroundWords"> & {
  words?: SpacedWord[];
  backgroundWords?: SpacedWord[];
  begin?: number;
  end?: number;
};

interface SavedProject {
  version: 1 | 2 | 3;
  savedAt: number;
  metadata: ProjectMetadata;
  agents: Agent[];
  lines: SavedLine[];
  groups?: LinkGroup[];
  granularity: GranularityMode;
  exportTiming?: TimingGranularity;
  syllableSplitDefaults?: SyllableSplitDefaults;
  audioFileName?: string;
  audioSource?: SavedAudioSource;
  dismissedSuggestions?: string[];
  dismissedExplicitSuggestions?: string[];
  dismissedMetadataMatches?: string[];
  currentStem?: Stem;
  primingStripped?: boolean;
  primingCorrected?: boolean;
  customSnapPoints?: (SnapPoint | number)[];
  beatGrid?: unknown;
  hasUnexportedImport?: boolean;
  importedMetadataKeys?: MetadataKey[];
  ttmlEditState?: TtmlEditState;
  alignedTimings?: unknown;
  alignmentNoticeDismissed?: boolean;
  unisonLyricId?: string;
  playedRanges?: unknown;
}

interface SavedAudioFile {
  name: string;
  type: string;
  data: StoredData;
}

// -- Constants ----------------------------------------------------------------

const SAVED_PROJECT_VERSION = 3;

// -- Errors -------------------------------------------------------------------

class NewerProjectError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`Project ${projectId} was saved by a newer version of Composer`);
    this.name = "NewerProjectError";
    this.projectId = projectId;
  }
}

// -- Lines ----------------------------------------------------------------------

// Ids are session-only: anything already on saved words came from outside and is never trusted.
function wordsFromSaved(words: readonly SpacedWord[]): WordTiming[] {
  return wordsFromSpaced(words.map(({ id: _id, ...word }) => word));
}

function storeLine(line: SavedLine, splitChar: string): LyricLine {
  const { words, backgroundWords, ...fields } = line;
  const storeWords = words && wordsFromSaved(words);
  const storeBackgroundWords = backgroundWords && wordsFromSaved(backgroundWords);
  return reconcileLine({
    ...fields,
    ...(storeWords?.length && { text: withSplitMarksFromWords(fields.text, storeWords, splitChar) }),
    ...(storeBackgroundWords?.length &&
      fields.backgroundText !== undefined && {
        backgroundText: withSplitMarksFromWords(fields.backgroundText, storeBackgroundWords, splitChar),
      }),
    words: storeWords,
    ...(storeBackgroundWords && { backgroundWords: storeBackgroundWords }),
  });
}

function savedLine(line: LyricLine): SavedLine {
  return {
    ...line,
    ...(line.words && { words: spacedFromWords(line.words) }),
    ...(line.backgroundWords && { backgroundWords: spacedFromWords(line.backgroundWords) }),
  };
}

function linesFromSaved(lines: readonly SavedLine[]): LyricLine[] {
  const splitChar = getSplitCharacter();
  return lines.map((line) => storeLine(line, splitChar));
}

function savedLines(lines: readonly LyricLine[]): SavedLine[] {
  return lines.map(savedLine);
}

// -- Upgrade ------------------------------------------------------------------

function isFromNewerComposer(saved: { version?: unknown } | undefined): boolean {
  return typeof saved?.version === "number" && saved.version > SAVED_PROJECT_VERSION;
}

function upgradeSavedProject(project: SavedProject): boolean {
  if (project.version >= SAVED_PROJECT_VERSION) return false;
  if (Array.isArray(project.lines)) {
    project.lines = savedLines(linesFromSaved(project.lines).map(migrateLegacyTransliterationLine));
  }
  project.version = SAVED_PROJECT_VERSION;
  return true;
}

// -- Exports ------------------------------------------------------------------

export type { SavedAudioFile, SavedLine, SavedProject };
export {
  NewerProjectError,
  SAVED_PROJECT_VERSION,
  isFromNewerComposer,
  linesFromSaved,
  savedLines,
  upgradeSavedProject,
};
