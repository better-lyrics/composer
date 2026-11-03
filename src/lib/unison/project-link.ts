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

async function writeSavedLink(projectId: string, lyricId: string | null): Promise<void> {
  try {
    await updateProjectRecord(projectId, ({ unisonLyricId: _previous, ...project }) =>
      lyricId === null ? project : { ...project, unisonLyricId: lyricId },
    );
  } catch (error) {
    console.warn(LOG_PREFIX, `Could not update the Unison link of project ${projectId}`, error);
  }
}

function captureLinkTarget(): LinkTarget {
  return { projectId: openProjectIdSnapshot(), session: useProjectStore.getState().projectSession };
}

async function linkProjectToLyric(target: LinkTarget, lyricId: string): Promise<void> {
  if (useProjectStore.getState().projectSession === target.session) {
    useProjectStore.getState().linkUnisonLyric(lyricId);
    return;
  }
  if (target.projectId) await writeSavedLink(target.projectId, lyricId);
}

async function unlinkProjectsFromLyric(lyricId: string): Promise<void> {
  const openId = openProjectIdSnapshot();
  const project = useProjectStore.getState();
  if (project.unisonLyricId === lyricId) project.unlinkUnisonLyric();
  const linked = (await listProjectIndex()).filter((entry) => entry.unisonLyricId === lyricId && entry.id !== openId);
  await Promise.all(linked.map((entry) => writeSavedLink(entry.id, null)));
}

// -- Exports -------------------------------------------------------------------

export { captureLinkTarget, linkProjectToLyric, unlinkProjectsFromLyric };
