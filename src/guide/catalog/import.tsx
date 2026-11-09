import { stageTip } from "@/guide/catalog/types";
import {
  IconFileMusic,
  IconFileText,
  IconFolderOpen,
  IconMicrophone2,
  IconReplace,
  IconSearch,
} from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("import");

const IMPORT_TIPS = [
  tip({
    id: "audio",
    tier: "basics",
    icon: IconFileMusic,
    title: "Bring in the song",
    gist: <>Drop an audio file, or paste a YouTube link.</>,
    spot: { stage: "import", spot: "importDrop", text: "Drop your song here, or paste a YouTube link" },
  }),
  tip({
    id: "lyrics",
    tier: "basics",
    icon: IconFileText,
    title: "Add lyrics from a file",
    gist: <>Drop a .txt, .lrc, .srt or .ttml file.</>,
    spot: { stage: "edit", spot: "importLyrics", text: "Import your lyrics here, or paste them in the editor" },
  }),
  tip({
    id: "search",
    tier: "further",
    icon: IconSearch,
    title: "Search for lyrics",
    gist: <>Search the lyrics providers and pick a match.</>,
    spot: { stage: "edit", spot: "importLyrics", text: "Open Import Lyrics to search for your song" },
  }),
  tip({
    id: "projectFile",
    tier: "further",
    icon: IconFolderOpen,
    title: "Open a project file",
    gist: <>Drop a .composer file to pick up where you left off.</>,
  }),
  tip({
    id: "replaceAudio",
    tier: "further",
    icon: IconReplace,
    title: "Swap the song file",
    gist: <>Use Replace to change the song file without losing your timing.</>,
  }),
  tip({
    id: "stems",
    tier: "pro",
    icon: IconMicrophone2,
    title: "Bring your own stems",
    gist: <>Already have the vocal on its own? Import it instead of separating.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { IMPORT_TIPS };
