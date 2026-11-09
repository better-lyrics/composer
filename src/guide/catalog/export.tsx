import { stageTip } from "@/guide/catalog/types";
import {
  IconClockHour4,
  IconCloudUpload,
  IconCode,
  IconDeviceFloppy,
  IconDownload,
  IconHistory,
  IconPlugConnected,
  IconRefresh,
  IconTags,
} from "@tabler/icons-react";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("export");

const EXPORT_TIPS = [
  tip({
    id: "get",
    tier: "basics",
    icon: IconDownload,
    title: "Get your TTML",
    gist: <>Copy it, or download the file.</>,
  }),
  tip({
    id: "timing",
    tier: "basics",
    icon: IconClockHour4,
    title: "Word or line timing",
    gist: <>Pick whether the file carries word timing or line timing.</>,
  }),
  tip({
    id: "details",
    tier: "further",
    icon: IconTags,
    title: "Fill in song details",
    gist: <>Accept the MusicBrainz match to add album, songwriters and ISRC.</>,
  }),
  tip({
    id: "editTtml",
    tier: "further",
    icon: IconCode,
    title: "Edit the TTML by hand",
    gist: <>Click Edit, change what you need, then Done.</>,
  }),
  tip({
    id: "backup",
    tier: "further",
    icon: IconDeviceFloppy,
    title: "Keep a project file",
    gist: <>Use Project, then Export project, to save a copy you can open anywhere.</>,
  }),
  tip({
    id: "unisonConnect",
    tier: "pro",
    icon: IconPlugConnected,
    title: "Connect to Unison",
    gist: <>Sign in with Better Lyrics from the Unison panel.</>,
  }),
  tip({
    id: "unisonSubmit",
    tier: "pro",
    icon: IconCloudUpload,
    title: "Share it on Unison",
    gist: <>Submit once every check in the panel passes.</>,
  }),
  tip({
    id: "unisonUpdate",
    tier: "pro",
    icon: IconRefresh,
    title: "Send an update",
    gist: <>Fixed something? Send it as a new revision.</>,
  }),
  tip({
    id: "unisonHistory",
    tier: "pro",
    icon: IconHistory,
    title: "Read the history",
    gist: <>Open History to see what changed in each revision.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { EXPORT_TIPS };
