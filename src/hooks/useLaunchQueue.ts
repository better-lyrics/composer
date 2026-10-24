import { ONE_SONG_AT_A_TIME_MESSAGE } from "@/audio/use-file-drop";
import { useStartNewSong } from "@/hooks/useStartNewSong";
import { bootLocationHref } from "@/lib/boot-entry";
import { firstLaunchedFile, isWindowOpeningLaunch, launchTargetAction } from "@/lib/launched-file";
import { openLyricsFileAsNewProject } from "@/lib/open-lyrics-as-project";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { importProjectFile } from "@/lib/project-import";
import { EDITOR_PATH } from "@/utils/app-routes";
import { useEffect, useEffectEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// -- Types --------------------------------------------------------------------

interface LaunchHandlers {
  navigate: (path: string) => void;
  startWithFile: (file: File) => void;
}

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Launch]";
const UNSUPPORTED_LAUNCH_MESSAGE = "Composer can't open that file";
const UNREADABLE_LAUNCH_MESSAGE = "Couldn't read that file";

// -- State --------------------------------------------------------------------

// Per document, not per mount: a remount or a reload must not mistake a later launch for the opening one.
let anyLaunchSeen = false;

// -- Helpers ------------------------------------------------------------------

async function readLaunchedFiles(handles: readonly FileSystemFileHandle[]): Promise<File[] | null> {
  try {
    return await Promise.all(handles.map((handle) => handle.getFile()));
  } catch (error) {
    console.error(LOG_PREFIX, "could not read the opened files", error);
    toast.error(UNREADABLE_LAUNCH_MESSAGE);
    return null;
  }
}

async function openLaunchedFiles(handles: readonly FileSystemFileHandle[], handlers: LaunchHandlers): Promise<void> {
  const files = await readLaunchedFiles(handles);
  if (!files) return;
  const picked = firstLaunchedFile(files);
  if (!picked) {
    toast.error(UNSUPPORTED_LAUNCH_MESSAGE);
    return;
  }
  if (picked.skipped > 0) toast(ONE_SONG_AT_A_TIME_MESSAGE);
  if (picked.kind === "audio") {
    handlers.startWithFile(picked.file);
    return;
  }
  const opened =
    picked.kind === "project" ? await importProjectFile(picked.file) : await openLyricsFileAsNewProject(picked.file);
  if (opened) handlers.navigate(EDITOR_PATH);
}

// Reload, not assign: a hash-only target would otherwise stay in the same document and never reach boot.
async function reloadInto(targetURL: string): Promise<void> {
  try {
    await flushPendingSave();
  } catch (error) {
    console.error(LOG_PREFIX, "could not save before opening the link", error);
  }
  window.history.replaceState(null, "", targetURL);
  window.location.reload();
}

// -- Hook ---------------------------------------------------------------------

function useLaunchQueue(): void {
  const navigate = useNavigate();
  const { startWithFile } = useStartNewSong();

  const consumeLaunch = useEffectEvent((params: LaunchParams) => {
    const target = params.targetURL ? URL.parse(params.targetURL) : null;
    const opening = target !== null && isWindowOpeningLaunch(target, bootLocationHref(), anyLaunchSeen);
    anyLaunchSeen = true;
    if (params.files.length > 0) {
      void openLaunchedFiles(params.files, { navigate, startWithFile });
      return;
    }
    if (!target) return;
    const action = launchTargetAction(target, opening);
    if (action.kind === "navigate") navigate(action.path);
    if (action.kind === "reload") void reloadInto(target.href);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect Events always read current state and must not be dependencies.
  useEffect(() => {
    window.launchQueue?.setConsumer((params) => consumeLaunch(params));
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLaunchQueue };
