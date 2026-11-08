import type { LinkSuggestion } from "@/domain/unison/link-suggestions";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { listProjectIndex, updateProjectRecord } from "@/lib/project-repository";
import { useProjectStore } from "@/stores/project";

// -- Types ---------------------------------------------------------------------

interface LinkTarget {
  projectId: string | undefined;
  session: number;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonLink]";

// -- Functions -----------------------------------------------------------------

async function writeSavedLink(projectId: string, lyricId: string | null): Promise<boolean> {
  try {
    await updateProjectRecord(projectId, ({ unisonLyricId: _previous, ...project }) =>
      lyricId === null ? project : { ...project, unisonLyricId: lyricId },
    );
    return true;
  } catch (error) {
    console.warn(LOG_PREFIX, `Could not update the Unison link of project ${projectId}`, error);
    return false;
  }
}

function captureLinkTarget(): LinkTarget {
  return { projectId: openProjectIdSnapshot(), session: useProjectStore.getState().projectSession };
}

async function linkProjectToLyric(target: LinkTarget, lyricId: string): Promise<boolean> {
  const sameProject = target.projectId === undefined || openProjectIdSnapshot() === target.projectId;
  if (sameProject && useProjectStore.getState().projectSession === target.session) {
    useProjectStore.getState().linkUnisonLyric(lyricId);
    return true;
  }
  if (!target.projectId) {
    console.warn(LOG_PREFIX, `The project that sent lyric ${lyricId} closed before it was saved`);
    return false;
  }
  const saved = await writeSavedLink(target.projectId, lyricId);
  if (saved && openProjectIdSnapshot() === target.projectId) useProjectStore.getState().linkUnisonLyric(lyricId);
  return saved;
}

async function unlinkProjectsFromLyric(lyricId: string): Promise<void> {
  const openId = openProjectIdSnapshot();
  const project = useProjectStore.getState();
  if (project.unisonLyricId === lyricId) project.unlinkUnisonLyric();
  try {
    const linked = (await listProjectIndex()).filter((entry) => entry.unisonLyricId === lyricId && entry.id !== openId);
    await Promise.all(linked.map((entry) => writeSavedLink(entry.id, null)));
  } catch (error) {
    console.warn(LOG_PREFIX, `Could not unlink saved projects from lyric ${lyricId}`, error);
  }
}

async function linkProjectsToLyrics(links: readonly LinkSuggestion[]): Promise<LinkSuggestion[]> {
  const session = useProjectStore.getState().projectSession;
  const saved = await Promise.all(
    links.map((link) => linkProjectToLyric({ projectId: link.projectId, session }, link.lyricId)),
  );
  return links.filter((_, index) => saved[index]);
}

// -- Exports -------------------------------------------------------------------

export { captureLinkTarget, linkProjectToLyric, linkProjectsToLyrics, unlinkProjectsFromLyric };
