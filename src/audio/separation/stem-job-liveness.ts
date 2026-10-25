import type { StemRecord } from "@/audio/separation/stem-derived-records";
import { PROJECT_STEMS_STORE_NAME, STEM_STORE_NAME } from "@/lib/persistence-idb";
import type { SavedProjectStems } from "@/lib/project-stems";

// -- Constants ----------------------------------------------------------------

const PROJECT_JOB_PREFIX = "project|";
const REVISION_SEPARATOR = "|r";

// -- Keys ---------------------------------------------------------------------

function projectStemJobKey(projectId: string, revision: number): string {
  return `${PROJECT_JOB_PREFIX}${projectId}${REVISION_SEPARATOR}${revision}`;
}

function parseProjectStemJobKey(jobKey: string): { projectId: string; revision: number } | null {
  if (!jobKey.startsWith(PROJECT_JOB_PREFIX)) return null;
  const rest = jobKey.slice(PROJECT_JOB_PREFIX.length);
  const split = rest.lastIndexOf(REVISION_SEPARATOR);
  if (split < 0) return null;
  const revision = Number(rest.slice(split + REVISION_SEPARATOR.length));
  return Number.isInteger(revision) ? { projectId: rest.slice(0, split), revision } : null;
}

// -- Liveness -----------------------------------------------------------------

function whenProjectJobLive(tx: IDBTransaction, job: { projectId: string; revision: number }, write: () => void) {
  const request = tx.objectStore(PROJECT_STEMS_STORE_NAME).get(job.projectId);
  request.onsuccess = () => {
    if ((request.result as SavedProjectStems | undefined)?.revision === job.revision) write();
  };
}

function whenCacheJobLive(tx: IDBTransaction, jobKey: string, write: () => void) {
  const request = tx.objectStore(STEM_STORE_NAME).openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const record = cursor.value as StemRecord;
    if (record.jobKey === jobKey && record.createdAt > 0) {
      write();
      return;
    }
    cursor.continue();
  };
}

function whenStemJobLive(tx: IDBTransaction, jobKey: string, write: () => void): void {
  const projectJob = parseProjectStemJobKey(jobKey);
  if (projectJob) whenProjectJobLive(tx, projectJob, write);
  else whenCacheJobLive(tx, jobKey, write);
}

// -- Exports ------------------------------------------------------------------

export { projectStemJobKey, whenStemJobLive };
