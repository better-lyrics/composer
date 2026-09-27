import { useCallback } from "react";
import { toast } from "sonner";
import { probeAudioFile } from "@/audio/probe-audio-file";
import { confirmClearImportedSongDetails } from "@/hooks/imported-song-details";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { audioTagsToMetadata } from "@/utils/audio-tags";
import { fileIdentityKey } from "@/utils/file-identity";
import { fileNameWithoutExtension } from "@/utils/file-name";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";
const UNPLAYABLE_AUDIO_MESSAGE = "That file is not playable audio.";

// -- Types --------------------------------------------------------------------

type TagWrite = "apply" | "skip";

// -- State --------------------------------------------------------------------

let latestPick: File | null = null;

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

function useLoadAudioFile(): (file: File) => Promise<void> {
  return useCallback(async (file: File) => {
    latestPick = file;
    const probe = await probeAudioFile(file);
    if (latestPick !== file) return;
    if (!probe.ok) {
      toast.error(UNPLAYABLE_AUDIO_MESSAGE);
      return;
    }

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
