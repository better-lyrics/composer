import { type LinkSuggestion, linkCandidates } from "@/domain/unison/link-suggestions";
import { lyricsWithoutProject } from "@/domain/unison/linked-projects";
import { deleteProject } from "@/lib/open-project";
import { hiddenProjectIdsSnapshot } from "@/lib/pending-deletions";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { listProjectIndex } from "@/lib/project-repository";
import { loadProjectRecord } from "@/lib/project-storage";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { type LyricLoader, linksByContent } from "@/lib/unison/live-lyric-match";
import { linkProjectsToLyrics, unlinkProjectsFromLyric } from "@/lib/unison/project-link";
import { type AddedProject, saveUnisonLyricProject } from "@/lib/unison/save-unison-projects";

// -- Types ---------------------------------------------------------------------

interface AddedLyrics {
  created: AddedProject[];
  linked: LinkSuggestion[];
}

interface AddOutcome extends AddedLyrics {
  unresolved: number;
  failed: number;
  lastError: unknown;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonAddAll]";

// -- Adding --------------------------------------------------------------------

// Projects that already hold a lyric are linked to it, never copied. Only lyrics with no project at all are saved.
async function addUnisonLyricsToProjects(
  items: readonly UnisonMineItem[],
  loadLyric: LyricLoader,
): Promise<AddOutcome> {
  await flushPendingSave();
  const hidden = hiddenProjectIdsSnapshot();
  const entries = (await listProjectIndex()).filter((entry) => !hidden.has(entry.id));
  const pending = lyricsWithoutProject(items, entries);
  const { sure, unsure } = linkCandidates(entries, pending);
  const matched = new Set([...sure, ...unsure].map((candidate) => candidate.lyricId));
  const byContent = await linksByContent(unsure, entries, loadLyric);
  const toLink = [...sure, ...byContent.links];
  const linked = await linkProjectsToLyrics(toLink);
  const missing = pending.filter((item) => !matched.has(String(item.id))).toSorted((a, b) => b.createdAt - a.createdAt);
  // A millisecond apart, newest upload last saved, so the library lists them in the order they reached Unison.
  const addedAt = Date.now();
  const saves = await Promise.allSettled(
    missing.map(async (item, rank) => saveUnisonLyricProject(await loadLyric(String(item.id)), addedAt - rank)),
  );
  const created = saves.flatMap((save) => (save.status === "fulfilled" && save.value ? [save.value] : []));
  const rejected = saves.flatMap((save) => (save.status === "rejected" ? [save.reason] : []));
  for (const reason of rejected) console.error(LOG_PREFIX, "could not add a lyric to Projects", reason);
  return {
    created,
    linked,
    unresolved: byContent.unresolved.length,
    failed: missing.length - created.length + toLink.length - linked.length,
    lastError: rejected.at(-1) ?? null,
  };
}

// -- Undo ----------------------------------------------------------------------

// A project saved since it was added holds someone's work, so Undo keeps it. Returns how many it kept.
async function undoAddedLyrics({ created, linked }: AddedLyrics): Promise<number> {
  await flushPendingSave();
  const records = await Promise.all(created.map(({ id }) => loadProjectRecord(id)));
  const unedited = created.filter((project, index) => records[index]?.savedAt === project.savedAt);
  const kept = records.filter((record, index) => record && record.savedAt !== created[index]?.savedAt).length;
  await Promise.all(unedited.map(({ id }) => deleteProject(id)));
  await Promise.all(linked.map(({ lyricId }) => unlinkProjectsFromLyric(lyricId)));
  return kept;
}

// -- Exports -------------------------------------------------------------------

export type { AddOutcome };
export { addUnisonLyricsToProjects, undoAddedLyrics };
