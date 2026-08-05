import { normalizeLoadedMetadata } from "@/domain/project/normalize-metadata";
import { loadCurrentProject } from "@/lib/persistence";
import { useProjectStore } from "@/stores/project";

// -- Emptiness ----------------------------------------------------------------

// Checks the live store first, then the persisted project, so a deep link that
// lands before persistence restores still sees the work it would overwrite.
async function isProjectNonEmpty(): Promise<boolean> {
  const state = useProjectStore.getState();
  if (state.lines.length > 0) return true;
  const { title, artists, album } = state.metadata;
  if (title || artists.length || album) return true;

  // A read failure is reported, not swallowed: whether an unreadable project
  // should block a destructive action depends on what that action replaces, so
  // the decision belongs to the caller.
  const saved = await loadCurrentProject();
  if (!saved) return false;
  if (saved.lines.length > 0) return true;
  const savedMetadata = normalizeLoadedMetadata(saved.metadata);
  return Boolean(savedMetadata.title || savedMetadata.artists.length || savedMetadata.album);
}

// -- Exports ------------------------------------------------------------------

export { isProjectNonEmpty };
