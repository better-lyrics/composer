import { createProject } from "@/lib/open-project";
import { useProjectStore } from "@/stores/project";
import { detectFileType } from "@/utils/lyrics-parsers/detect";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { readLyricsFile, replaceWithParsedLyrics } from "@/views/lyrics-import-modal/import-lyrics";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[OpenLyricsAsProject]";

// -- Opening ------------------------------------------------------------------

function openLyricsAsNewProject(content: string, fileName: string): string | null {
  const read = readLyricsFile(fileName, content);
  if (read.status === "unreadable") {
    toast.error(read.message);
    return null;
  }
  const id = createProject();
  const skipped = replaceWithParsedLyrics(read.parsed);
  useProjectStore.getState().clearHistory();
  toast(`Opened ${fileName} as a new project from its ${detectFileType(fileName, content).toUpperCase()}`);
  if (skipped > 0) toast.warning(skippedLinesMessage(skipped));
  return id;
}

async function openLyricsFileAsNewProject(file: File): Promise<string | null> {
  let text: string;
  try {
    text = await file.text();
  } catch (error) {
    console.error(LOG_PREFIX, "could not read the lyrics file", error);
    toast.error(`Couldn't read ${file.name}`);
    return null;
  }
  return openLyricsAsNewProject(text, file.name);
}

// -- Exports ------------------------------------------------------------------

export { openLyricsAsNewProject, openLyricsFileAsNewProject };
