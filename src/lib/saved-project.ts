import type { Stem } from "@/audio/separation/types";
import type { Agent } from "@/domain/agent/model";
import type { LinkGroup } from "@/domain/group/template";
import { migrateLegacyTransliterationLine } from "@/domain/language/migrate";
import {
  type V3LanguageFields,
  type V3Piece,
  languagesFromV3,
  v3Languages,
  v3PiecesOf,
  v3WordPieces,
  withoutV3Piece,
} from "@/domain/language/v3-languages";
import { withTrailingJoinFromText } from "@/domain/line/line-from-fields";
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

type SavedWord = SpacedWord & V3Piece;

// A line as saved in a version 3 record or link: words keep their separator inside `text` and their reading.
type SavedLine = Omit<LineFields, "backgroundWords" | "languages"> &
  V3LanguageFields & {
    words?: SavedWord[];
    backgroundWords?: SavedWord[];
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
function wordsFromSaved(words: readonly SavedWord[]): WordTiming[] {
  return wordsFromSpaced(words.map(({ id: _id, ...word }) => withoutV3Piece(word)));
}

function savedWords(words: readonly WordTiming[], pieces: readonly V3Piece[] | undefined): SavedWord[] {
  return spacedFromWords(words).map((word, index) => ({ ...word, ...pieces?.[index] }));
}

function storeLine(line: SavedLine, splitChar: string): LyricLine {
  const { words, backgroundWords, translations, transliteration, ...fields } = line;
  const storeWords = words && wordsFromSaved(words);
  const storeBackgroundWords = backgroundWords && wordsFromSaved(backgroundWords);
  const text = storeWords?.length ? withSplitMarksFromWords(fields.text, storeWords, splitChar) : fields.text;
  const backgroundText =
    storeBackgroundWords?.length && fields.backgroundText !== undefined
      ? withSplitMarksFromWords(fields.backgroundText, storeBackgroundWords, splitChar)
      : fields.backgroundText;
  const mainWords = storeWords && withTrailingJoinFromText(text, storeWords);
  const bgWords = storeBackgroundWords && withTrailingJoinFromText(backgroundText ?? "", storeBackgroundWords);
  const languages = languagesFromV3(
    { translations, transliteration },
    { main: v3PiecesOf(words), bg: v3PiecesOf(backgroundWords) },
    { words: mainWords, backgroundWords: bgWords },
  );
  return reconcileLine({
    ...fields,
    text,
    ...(backgroundText !== undefined && { backgroundText }),
    words: mainWords,
    ...(bgWords && { backgroundWords: bgWords }),
    ...(languages && { languages }),
  });
}

function savedLine(line: LyricLine): SavedLine {
  const { languages, ...fields } = line;
  return {
    ...fields,
    ...(line.words && { words: savedWords(line.words, v3WordPieces(line.words, languages, "main")) }),
    ...(line.backgroundWords && {
      backgroundWords: savedWords(line.backgroundWords, v3WordPieces(line.backgroundWords, languages, "bg")),
    }),
    ...v3Languages(languages),
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
