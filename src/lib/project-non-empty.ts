import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { findOpenProjectId } from "@/lib/open-project-session";
import { loadProjectRecord } from "@/lib/project-storage";
import { useProjectStore } from "@/stores/project";

// -- Emptiness ----------------------------------------------------------------

// A read failure rejects: whether an unreadable project blocks a destructive action is the caller's call.
async function isProjectNonEmpty(): Promise<boolean> {
  const state = useProjectStore.getState();
  if (state.lines.length > 0) return true;
  const { title, artists, album } = state.metadata;
  if (title || artists.length || album) return true;

  const id = await findOpenProjectId();
  const saved = id ? await loadProjectRecord(id) : undefined;
  if (!saved) return false;
  if (saved.lines.length > 0) return true;
  const savedMetadata = normalizeLoadedMetadata(saved.metadata);
  return Boolean(savedMetadata.title || savedMetadata.artists.length || savedMetadata.album);
}

// -- Exports ------------------------------------------------------------------

export { isProjectNonEmpty };
