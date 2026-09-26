import { useCallback } from "react";
import { confirmClearImportedSongDetails } from "@/hooks/imported-song-details";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { audioTagsToMetadata } from "@/utils/audio-tags";
import { fileIdentityKey } from "@/utils/file-identity";
import { fileNameWithoutExtension } from "@/utils/file-name";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Types --------------------------------------------------------------------

type TagWrite = "apply" | "skip";

// -- Helpers ------------------------------------------------------------------

function isActiveFile(file: File): boolean {
  const active = useAudioStore.getState().source;
  return active?.type === "file" && active.file === file;
}

function settleSongDetails(file: File, replacesDifferentSong: boolean, title: string): Promise<TagWrite> {
  const project = useProjectStore.getState();
  if (!replacesDifferentSong) {
    project.setMetadata({ title });
    project.clearUnexportedImport();
    return Promise.resolve("apply");
  }
  if (!project.hasUnexportedImport) {
    project.resetSongIdentity(title);
    return Promise.resolve("apply");
  }
  return confirmClearImportedSongDetails().then((clear) => {
    if (!isActiveFile(file)) return "skip";
    const current = useProjectStore.getState();
    if (clear) {
      current.resetSongIdentity(title);
      return "apply";
    }
    current.clearUnexportedImport();
    return "skip";
  });
}

async function applyAudioTags(file: File): Promise<void> {
  const { parseBlob } = await import("music-metadata");
  const { common } = await parseBlob(file);
  if (!isActiveFile(file)) return;
  const patch = audioTagsToMetadata(common);
  if (Object.keys(patch).length > 0) useProjectStore.getState().setMetadata(patch);
}

// -- Hook ---------------------------------------------------------------------

function useLoadAudioFile(): (file: File) => void {
  return useCallback((file: File) => {
    const previous = useAudioStore.getState().source;
    useAudioStore.getState().setSource({ type: "file", file });

    const title = fileNameWithoutExtension(file.name);
    const replacesDifferentSong =
      previous != null && !(previous.type === "file" && fileIdentityKey(previous.file) === fileIdentityKey(file));

    void settleSongDetails(file, replacesDifferentSong, title)
      .then((tagWrite) => (tagWrite === "apply" ? applyAudioTags(file) : undefined))
      .catch((error) => {
        console.warn(`${LOG_PREFIX} could not read audio tags`, error);
      });
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLoadAudioFile };
