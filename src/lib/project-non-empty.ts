import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { loadCurrentProject } from "@/lib/persistence";
import { useProjectStore } from "@/stores/project";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Emptiness ----------------------------------------------------------------

// Checks the live store first, then the persisted project, so a deep link that
// lands before persistence restores still sees the work it would overwrite.
async function isProjectNonEmpty(): Promise<boolean> {
  const state = useProjectStore.getState();
  if (state.lines.length > 0) return true;
  const { title, artists, album } = state.metadata;
  if (title || artists.length || album) return true;

  let saved: Awaited<ReturnType<typeof loadCurrentProject>>;
  try {
    saved = await loadCurrentProject();
  } catch (error) {
    console.warn(`${LOG_PREFIX} could not read the saved project`, error);
    return false;
  }
  if (!saved) return false;
  if (saved.lines.length > 0) return true;
  const savedMetadata = normalizeLoadedMetadata(saved.metadata);
  return Boolean(savedMetadata.title || savedMetadata.artists.length || savedMetadata.album);
}

// -- Exports ------------------------------------------------------------------

export { isProjectNonEmpty };
