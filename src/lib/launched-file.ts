import { isSupportedAudioFile } from "@/domain/audio-file/supported-formats";
import { isSupportedLyricsFile } from "@/domain/lyrics-file/supported-formats";
import { isProjectFileName } from "@/lib/project-file-read";
import { hasIncomingLink } from "@/utils/incoming-link";

// -- Types --------------------------------------------------------------------

type LaunchedFileKind = "project" | "lyrics" | "audio";

interface LaunchedFile {
  file: File;
  kind: LaunchedFileKind;
  skipped: number;
}

type LaunchTargetAction = { kind: "ignore" } | { kind: "reload" } | { kind: "navigate"; path: string };

// -- Files --------------------------------------------------------------------

function launchedFileKind(file: File): LaunchedFileKind | null {
  if (isProjectFileName(file.name)) return "project";
  if (isSupportedLyricsFile(file.name)) return "lyrics";
  if (isSupportedAudioFile(file)) return "audio";
  return null;
}

function firstLaunchedFile(files: readonly File[]): LaunchedFile | null {
  for (const file of files) {
    const kind = launchedFileKind(file);
    if (kind) return { file, kind, skipped: files.length - 1 };
  }
  return null;
}

// -- Targets ------------------------------------------------------------------

function launchTargetAction(target: URL, isWindowOpeningLaunch: boolean): LaunchTargetAction {
  if (isWindowOpeningLaunch) return { kind: "ignore" };
  if (hasIncomingLink(target)) return { kind: "reload" };
  return { kind: "navigate", path: target.pathname };
}

// -- Exports ------------------------------------------------------------------

export { firstLaunchedFile, launchTargetAction, launchedFileKind };
export type { LaunchedFile, LaunchedFileKind, LaunchTargetAction };
