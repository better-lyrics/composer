import type { Part } from "insync/part";
import { type DocPassthrough, isEmptyDocPassthrough } from "insync/passthrough";
import type { SavedLine } from "insync/saved-line";
import type { Stem } from "@/audio/separation/types";
import type { Agent } from "insync/agent";
import { readAlignedTimings, timingFingerprint, v3TimingFingerprint } from "@/domain/alignment/fingerprint";
import type { LinkGroup } from "insync/group";
import { migrateLegacyTransliterationLine } from "insync/language-migrate";
import { withSeededBackground, withSeededBackgroundWords } from "insync/line-background";
import type { LyricLine } from "insync/line";
import { lineFromSaved, savedLine } from "insync/line-saved-line";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import type { MetadataKey } from "insync/project-imported-metadata";
import type { ProjectMetadata } from "insync/metadata";
import type { SyllableSplitDefaults } from "@/domain/project/syllable-split-defaults";
import type { StoredData } from "@/domain/storage/stored-data";
import type { TimingGranularity } from "insync/project-timing-granularity";
import type { SnapPoint } from "@/domain/snap-point/model";
import { linesFromSavedV3, type SavedLineV3 } from "@/lib/saved-project-v3";
import type { GranularityMode } from "@/stores/project";
import type { TtmlEditState } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface SavedProjectFields {
  savedAt: number;
  metadata: ProjectMetadata;
  agents: Agent[];
  groups?: LinkGroup[];
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
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

interface SavedProject extends SavedProjectFields {
  version: typeof SAVED_PROJECT_VERSION;
  lines: SavedLine[];
}

// A record or file saved before format 4.
interface SavedProjectV3 extends SavedProjectFields {
  version: 1 | 2 | 3;
  lines: SavedLineV3[];
}

type StoredProject = SavedProject | SavedProjectV3;

interface SavedAudioFile {
  name: string;
  type: string;
  data: StoredData;
}

// -- Constants ----------------------------------------------------------------

const SAVED_PROJECT_VERSION = 4;

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

function linesFromSaved(lines: readonly SavedLine[]): LyricLine[] {
  return lines.map(lineFromSaved);
}

function savedLines(lines: readonly LyricLine[]): SavedLine[] {
  return lines.map((line) => savedLine(line, { withIds: true }));
}

function savedLinesForLink(lines: readonly LyricLine[]): SavedLine[] {
  return lines.map((line) => savedLine(line, { withIds: false }));
}

// Song parts and kept TTML data are written only when a file brought some, so Composer's own projects gain no keys.
function savedKeptRoot({
  parts,
  passthrough,
}: Pick<SavedProjectFields, "parts" | "passthrough">): Pick<SavedProjectFields, "parts" | "passthrough"> {
  return { ...(parts?.length && { parts }), ...(!isEmptyDocPassthrough(passthrough) && { passthrough }) };
}

// Links made before format 4 carry no version or an older one.
function linesFromLink(link: { version?: unknown; lines: readonly unknown[] }): LyricLine[] {
  return link.version === SAVED_PROJECT_VERSION
    ? linesFromSaved(link.lines as SavedLine[])
    : linesFromSavedV3(link.lines as SavedLineV3[]);
}

// -- Upgrade ------------------------------------------------------------------

function isFromNewerComposer(saved: { version?: unknown } | undefined): boolean {
  return typeof saved?.version === "number" && saved.version > SAVED_PROJECT_VERSION;
}

// A line marked aligned stays aligned: its fingerprint moves to the whole-ms timing only where it matched before.
function rekeyedAlignedTimings(value: unknown, before: readonly LyricLine[], after: readonly LyricLine[]): unknown {
  const aligned = readAlignedTimings(value);
  if (Object.keys(aligned).length === 0) return value;
  const rekeyed = { ...aligned };
  before.forEach((line, index) => {
    const opened = withSeededBackgroundWords(line, getSplitCharacter());
    if (aligned[line.id] === v3TimingFingerprint(opened)) {
      rekeyed[line.id] = timingFingerprint(withSeededBackground(after[index], getSplitCharacter()));
    }
  });
  return rekeyed;
}

function upgradeSavedProject(project: StoredProject): SavedProject {
  if (isFromNewerComposer(project)) throw new Error(`Unsupported project version: ${project.version}`);
  // A corrupt record without lines is never stamped format 4: it stays as stored and opens empty, as before.
  if (!Array.isArray(project.lines)) return project as SavedProject;
  if (project.version === SAVED_PROJECT_VERSION) return project;
  const loaded = linesFromSavedV3(project.lines);
  const before =
    project.version < 3 ? loaded.map((value) => migrateLegacyTransliterationLine(value, getSplitCharacter())) : loaded;
  // 3.x seeded untimed background vocals on every open; the upgrade does it once, so later opens keep what was saved.
  const lines = savedLines(before.map((line) => withSeededBackground(line, getSplitCharacter())));
  const alignedTimings = rekeyedAlignedTimings(project.alignedTimings, before, linesFromSaved(lines));
  return {
    ...project,
    version: SAVED_PROJECT_VERSION,
    lines,
    ...(project.alignedTimings !== undefined && { alignedTimings }),
  };
}

// -- Exports ------------------------------------------------------------------

export type { SavedAudioFile, SavedLine, SavedProject, SavedProjectV3, StoredProject };
export {
  NewerProjectError,
  SAVED_PROJECT_VERSION,
  isFromNewerComposer,
  linesFromLink,
  linesFromSaved,
  savedKeptRoot,
  savedLines,
  savedLinesForLink,
  upgradeSavedProject,
};
