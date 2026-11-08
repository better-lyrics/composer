import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { agentsAfterImport } from "@/domain/agent/imported-agents";
import { metadataAfterImport } from "@/domain/project/imported-metadata";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { createProjectId, saveProjectRecord } from "@/lib/project-repository";
import { SAVED_PROJECT_VERSION, type SavedProject } from "@/lib/saved-project";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { fetchArtworkDataUrl } from "@/lib/unison/endpoints";
import { readUnisonLyric, withUnisonDetails } from "@/lib/unison/open-unison-lyric";
import { useSettingsStore } from "@/stores/settings";

// -- Types ---------------------------------------------------------------------

interface AddedProject {
  id: string;
  savedAt: number;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonProjects]";
// The cover is optional, so a slow one never holds up saving the lyrics.
const ARTWORK_TIMEOUT_MS = 5000;

// -- Records -------------------------------------------------------------------

// The same shape a lyric opened one at a time saves, minus audio: the YouTube source loads when the project opens.
function unisonLyricProject(lyric: UnisonLyric, thumbnail: string | null): SavedProject | null {
  const read = readUnisonLyric(lyric);
  if (read.status === "unreadable") return null;
  const parsed = withUnisonDetails(read.parsed, lyric);
  const details = metadataAfterImport(normalizeLoadedMetadata(null), [], parsed.metadata);
  const assignment = agentsAfterImport(DEFAULT_AGENTS, parsed.agents, parsed.lines);
  return {
    version: SAVED_PROJECT_VERSION,
    savedAt: Date.now(),
    metadata: {
      ...details.metadata,
      title: details.metadata.title || lyric.videoId,
      ...(thumbnail ? { thumbnailDataUrl: thumbnail, thumbnailForVideoId: lyric.videoId } : {}),
    },
    agents: assignment.agents,
    lines: assignment.lines,
    groups: parsed.groups ?? [],
    granularity: useSettingsStore.getState().defaultGranularity,
    audioSource: { kind: "youtube", videoId: lyric.videoId },
    importedMetadataKeys: details.importedKeys,
    hasUnexportedImport: details.importedKeys.length > 0 || (parsed.agents?.length ?? 0) > 0,
    unisonLyricId: String(lyric.id),
  };
}

// -- Saving --------------------------------------------------------------------

async function artworkOrNothing(videoId: string): Promise<string | null> {
  try {
    return await fetchArtworkDataUrl(videoId, { signal: AbortSignal.timeout(ARTWORK_TIMEOUT_MS) });
  } catch (error) {
    console.warn(LOG_PREFIX, `No artwork for ${videoId}`, error);
    return null;
  }
}

async function saveUnisonLyricProject(lyric: UnisonLyric): Promise<AddedProject | null> {
  const project = unisonLyricProject(lyric, await artworkOrNothing(lyric.videoId));
  if (!project) {
    console.warn(LOG_PREFIX, `Lyric ${lyric.id} could not be read`);
    return null;
  }
  const id = createProjectId();
  await saveProjectRecord(id, project);
  return { id, savedAt: project.savedAt };
}

// -- Exports -------------------------------------------------------------------

export type { AddedProject };
export { saveUnisonLyricProject, unisonLyricProject };
