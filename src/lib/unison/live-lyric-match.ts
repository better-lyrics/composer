import { mergeEditedTtmlLines } from "@/domain/line/edited-ttml-lines";
import { changedParts, editedLyricsWrite, type ProjectLyrics } from "@/domain/project/edited-lyrics";
import { changedMetadata, importableMetadata } from "@/domain/project/imported-metadata";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import type { LinkSuggestion, UnsureLink } from "@/domain/unison/link-suggestions";
import { loadProjectRecord } from "@/lib/project-storage";
import type { SavedProject } from "@/lib/saved-project";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { readUnisonLyric, withUnisonDetails } from "@/lib/unison/open-unison-lyric";

// -- Types ---------------------------------------------------------------------

type LyricLoader = (lyricId: string) => Promise<UnisonLyric>;

interface ContentLinks {
  links: LinkSuggestion[];
  unresolved: string[];
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonLinkByContent]";
const TIME_TOLERANCE_SECONDS = 0.01;

// -- Matching ------------------------------------------------------------------

// The same check Export's Done runs before it applies a TTML, read both ways for song details.
function matchesLiveLyric(project: SavedProject, lyric: UnisonLyric): boolean {
  const read = readUnisonLyric(lyric);
  if (read.status === "unreadable") return false;
  const parsed = withUnisonDetails(read.parsed, lyric);
  const current: ProjectLyrics = {
    lines: project.lines,
    groups: project.groups ?? [],
    agents: project.agents,
    metadata: normalizeLoadedMetadata(project.metadata),
  };
  const liveDetails = importableMetadata(parsed.metadata);
  const write = editedLyricsWrite(current, {
    lines: mergeEditedTtmlLines(project.lines, parsed),
    groups: parsed.groups ?? [],
    agents: parsed.agents,
    metadata: liveDetails,
  });
  const extraDetails = changedMetadata(normalizeLoadedMetadata(liveDetails), importableMetadata(current.metadata));
  return changedParts(current, write, TIME_TOLERANCE_SECONDS).length === 0 && Object.keys(extraDetails).length === 0;
}

// -- Linking ------------------------------------------------------------------

async function identicalProjects(lyric: UnisonLyric, projectIds: readonly string[]): Promise<string[]> {
  const records = await Promise.all(projectIds.map(loadProjectRecord));
  return projectIds.filter((_, index) => {
    const record = records[index];
    return record !== undefined && matchesLiveLyric(record, lyric);
  });
}

// Several identical projects resolve to the most recently edited one. None identical leaves the choice to the user.
async function linksByContent(
  unsure: readonly UnsureLink[],
  entries: readonly ProjectIndexEntry[],
  loadLyric: LyricLoader,
): Promise<ContentLinks> {
  const updatedAt = new Map(entries.map((entry) => [entry.id, entry.updatedAt]));
  const taken = new Set<string>();
  const result: ContentLinks = { links: [], unresolved: [] };
  for (const { lyricId, projectIds } of unsure) {
    let identical: string[] = [];
    try {
      const open = projectIds.filter((id) => !taken.has(id));
      identical = await identicalProjects(await loadLyric(lyricId), open);
    } catch (error) {
      console.warn(LOG_PREFIX, `Could not compare lyric ${lyricId} with its projects`, error);
    }
    const [projectId] = identical.toSorted((a, b) => (updatedAt.get(b) ?? 0) - (updatedAt.get(a) ?? 0));
    if (projectId === undefined) {
      result.unresolved.push(lyricId);
      continue;
    }
    taken.add(projectId);
    result.links.push({ projectId, lyricId });
  }
  return result;
}

// -- Exports -------------------------------------------------------------------

export type { LyricLoader };
export { linksByContent, matchesLiveLyric };
