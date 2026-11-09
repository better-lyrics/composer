import { stageTip } from "@/guide/catalog/types";
import { PROJECT_FILE_EXTENSIONS_LABEL } from "@/lib/project-file-read";
import {
  IconFileMusic,
  IconFolderOpen,
  IconMicrophone2,
  IconReplace,
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
    id: "projectFile",
    tier: "further",
    icon: IconFolderOpen,
    title: "Open a project file",
    gist: <>Drop a project file ({PROJECT_FILE_EXTENSIONS_LABEL}) to pick up where you left off.</>,
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
    gist: <>Already have the vocal on its own? Use Import file in the Stem menu instead of separating.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { IMPORT_TIPS };
