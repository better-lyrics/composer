import { probeAudioFile } from "@/audio/probe-audio-file";
import type { SavedAudioSource } from "@/domain/project/audio-source";
import { waitForYouTubeLoad } from "@/hooks/useLoadYouTubeSource";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { saveOpenProjectNow } from "@/lib/persistence-debounce";
import { useAudioStore } from "@/stores/audio";
import { useConfirmStore } from "@/stores/confirm-store";
import { toast } from "sonner";

// -- Helpers ------------------------------------------------------------------

function confirmDifferentFile(expected: string, dropped: string): Promise<boolean> {
  return useConfirmStore.getState().open({
    title: "Link a different file?",
    description: `“${dropped}” doesn't match “${expected}”. The timings may not line up if it's a different recording.`,
    confirmLabel: "Link file",
    variant: "primary",
  });
}

function needsConfirmation(expected: SavedAudioSource | null, file: File): expected is { kind: "file"; name: string } {
  return expected?.kind === "file" && expected.name !== file.name;
}

// -- Relinking ----------------------------------------------------------------

function isStillMissing(projectId: string | undefined): boolean {
  return openProjectIdSnapshot() === projectId && useAudioStore.getState().source === null;
}

async function relinkProjectAudioFile(file: File): Promise<boolean> {
  const projectId = openProjectIdSnapshot();
  const expected = useAudioStore.getState().expectedAudio;
  const probe = await probeAudioFile(file);
  if (!probe.ok) {
    toast.error("Couldn't link that file");
    return false;
  }
  if (!isStillMissing(projectId)) return false;
  if (needsConfirmation(expected, file) && !(await confirmDifferentFile(expected.name, file.name))) return false;
  if (!isStillMissing(projectId)) return false;
  useAudioStore.getState().setSource({ type: "file", file });
  await saveOpenProjectNow();
  return true;
}

async function relinkProjectVideo(videoId: string): Promise<void> {
  useAudioStore.getState().expectProjectAudio({ kind: "youtube", videoId });
  await Promise.all([saveOpenProjectNow(), waitForYouTubeLoad(videoId)]);
}

function retryProjectAudio(): void {
  const expected = useAudioStore.getState().expectedAudio;
  if (expected?.kind === "youtube") useAudioStore.getState().expectProjectAudio(expected);
}

// -- Exports ------------------------------------------------------------------

export { relinkProjectAudioFile, relinkProjectVideo, retryProjectAudio };
