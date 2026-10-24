import { ONE_SONG_AT_A_TIME_MESSAGE } from "@/audio/use-file-drop";
import { useStartNewSong } from "@/hooks/useStartNewSong";
import { firstLaunchedFile, launchTargetAction } from "@/lib/launched-file";
import { openLyricsFileAsNewProject } from "@/lib/open-lyrics-as-project";
import { flushPendingSave } from "@/lib/persistence-debounce";
import { importProjectFile } from "@/lib/project-import";
import { EDITOR_PATH } from "@/utils/app-routes";
import { useEffect, useRef } from "react";
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

// The pending save must land before the reload; if it fails, the beforeunload prompt still guards it.
async function reloadInto(targetURL: string): Promise<void> {
  try {
    await flushPendingSave();
  } catch (error) {
    console.error(LOG_PREFIX, "could not save before opening the link", error);
  }
  window.location.assign(targetURL);
}

// -- Hook ---------------------------------------------------------------------

function useLaunchQueue(): void {
  const navigate = useNavigate();
  const { startWithFile } = useStartNewSong();
  const handlersRef = useRef<LaunchHandlers>({ navigate, startWithFile });
  handlersRef.current = { navigate, startWithFile };

  useEffect(() => {
    const queue = window.launchQueue;
    if (!queue) return;
    let isWindowOpeningLaunch = true;
    queue.setConsumer((params) => {
      const opening = isWindowOpeningLaunch;
      isWindowOpeningLaunch = false;
      if (params.files.length > 0) {
        void openLaunchedFiles(params.files, handlersRef.current);
        return;
      }
      if (!params.targetURL) return;
      const action = launchTargetAction(new URL(params.targetURL), opening);
      if (action.kind === "navigate") handlersRef.current.navigate(action.path);
      if (action.kind === "reload") void reloadInto(params.targetURL);
    });
  }, []);
}

// -- Exports ------------------------------------------------------------------

export { useLaunchQueue };
