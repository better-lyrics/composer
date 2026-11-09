import { probeAudioFile } from "@/audio/probe-audio-file";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { confirmClearImportedSongDetails } from "@/hooks/imported-song-details";
import { adoptPrimingForNewAudio } from "@/lib/attach-audio-priming";
import { startSongInNewProject } from "@/lib/open-project";
import { noteGuideSignal } from "@/lib/guide-signals";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { relinkProjectAudioFile } from "@/lib/relink-audio";
import { sourceSwapPatch } from "@/domain/project/source-metadata";
import { beginSourceSwap, fileSourceMetadata, readAudioTags, settleSourceSwap } from "@/lib/source-metadata";
import { type AudioSource, isActiveAudioFile, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { fileIdentityKey } from "@/utils/file-identity";
import { fileNameWithoutExtension } from "@/utils/file-name";
import { showNewProjectToast } from "@/utils/project-toast";
import { useCallback } from "react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Composer]";
const UNPLAYABLE_AUDIO_MESSAGE = "That file is not playable audio.";

// -- Types --------------------------------------------------------------------

type TagWrite = "apply" | "skip";

type AudioLoadMode = "auto" | "replace";

// A song opened from a link: always a different song, never a relink, announced by the link.
type AudioFileLoadMode = AudioLoadMode | "new-song";

// -- State --------------------------------------------------------------------

let latestPick: File | null = null;

// -- Helpers ------------------------------------------------------------------

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
    if (!isActiveAudioFile(file)) return "skip";
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
  const patch = await readAudioTags(file);
  if (!isActiveAudioFile(file)) return;
  if (Object.keys(patch).length > 0) useProjectStore.getState().setMetadata(patch);
}

function logTagReadFailure(error: unknown): void {
  console.warn(`${LOG_PREFIX} could not read audio tags`, error);
}

function loadFileInPlace(file: File, replacesDifferentSong: boolean, title: string): Promise<void> {
  const asksBeforeClearing = replacesDifferentSong && useProjectStore.getState().hasUnexportedImport;
  adoptPrimingForNewAudio();
  useAudioStore.getState().setSource({ type: "file", file });
  const tagsWritten = settleSongDetails(file, replacesDifferentSong, title)
    .then((tagWrite) => (tagWrite === "apply" ? applyAudioTags(file) : undefined))
    .catch(logTagReadFailure);
  // A drop resolves while the clear-details confirm is still open.
  return asksBeforeClearing ? Promise.resolve() : tagsWritten;
}

async function swapFileInPlace(file: File, previous: AudioSource): Promise<void> {
  const target: AudioSource = { type: "file", file };
  const projectId = openProjectIdSnapshot();
  const baseline = beginSourceSwap(previous, target);
  adoptPrimingForNewAudio();
  useAudioStore.getState().setSource(target);
  const [before, next] = await Promise.all([baseline, fileSourceMetadata(file)]);
  if (!isActiveAudioFile(file) || openProjectIdSnapshot() !== projectId || !settleSourceSwap(target)) return;
  const { metadata, importedMetadataKeys } = useProjectStore.getState();
  const patch = sourceSwapPatch(metadata, importedMetadataKeys, before, next);
  if (Object.keys(patch).length > 0) useProjectStore.getState().setMetadata(patch);
}

async function startFileInNewProject(file: File, title: string, announce: boolean): Promise<void> {
  const started = await startSongInNewProject(title, (song) => {
    useAudioStore.getState().setSource({ type: "file", file });
    return song;
  });
  if (!started) {
    await loadFileInPlace(file, true, title);
    return;
  }
  if (announce) showNewProjectToast(title, started.previousTitle, started.previousId, started.newId);
  await applyAudioTags(file).catch(logTagReadFailure);
}

// -- Hook ---------------------------------------------------------------------

function useLoadAudioFile(): (file: File, mode?: AudioFileLoadMode) => Promise<void> {
  return useCallback(async (file: File, mode: AudioFileLoadMode = "auto") => {
    latestPick = file;
    const { source, expectedAudio } = useAudioStore.getState();
    const awaitsMissingAudio = source === null && expectedAudio !== null;
    if (awaitsMissingAudio && mode !== "new-song") {
      await relinkProjectAudioFile(file);
      return;
    }
    const probe = await probeAudioFile(file);
    if (latestPick !== file) return;
    if (!probe.ok) {
      toast.error(UNPLAYABLE_AUDIO_MESSAGE);
      return;
    }
    noteGuideSignal("import.audio");
    if (mode === "replace") noteGuideSignal("import.replaceAudio");

    const previous = useAudioStore.getState().source;
    const title = fileNameWithoutExtension(file.name);
    const replacesDifferentSong =
      mode === "new-song" ||
      (previous != null && !(previous.type === "file" && fileIdentityKey(previous.file) === fileIdentityKey(file)));

    if (mode === "replace") {
      if (replacesDifferentSong) void swapFileInPlace(file, previous);
      return;
    }
    const project = useProjectStore.getState();
    const keepsOpenProject = !hasLyricLines(project.lines) && !(mode === "new-song" && project.hasUnexportedImport);
    if (replacesDifferentSong && !keepsOpenProject) {
      await startFileInNewProject(file, title, mode !== "new-song");
      return;
    }

    await loadFileInPlace(file, replacesDifferentSong, title);
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLoadAudioFile };
export type { AudioFileLoadMode, AudioLoadMode };
