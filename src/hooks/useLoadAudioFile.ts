import { useCallback } from "react";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { audioTagsToMetadata } from "@/utils/audio-tags";
import { fileNameWithoutExtension } from "@/utils/file-name";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";

// -- Hook ---------------------------------------------------------------------

function useLoadAudioFile(): (file: File) => void {
  return useCallback((file: File) => {
    const previous = useAudioStore.getState().source;
    useAudioStore.getState().setSource({ type: "file", file });

    const project = useProjectStore.getState();
    const title = fileNameWithoutExtension(file.name);
    const replacesDifferentSong = previous != null && !(previous.type === "file" && previous.file === file);
    if (replacesDifferentSong) project.resetMetadataForNewSource(title);
    else project.setMetadata({ title });

    void import("music-metadata")
      .then(({ parseBlob }) => parseBlob(file))
      .then(({ common }) => {
        const active = useAudioStore.getState().source;
        const isStillTheActiveFile = active?.type === "file" && active.file === file;
        if (!isStillTheActiveFile) return;
        const patch = audioTagsToMetadata(common);
        if (Object.keys(patch).length > 0) useProjectStore.getState().setMetadata(patch);
      })
      .catch((error) => {
        console.warn(`${LOG_PREFIX} could not read audio tags`, error);
      });
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLoadAudioFile };
