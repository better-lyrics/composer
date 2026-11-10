import {
  IconClockHour4,
  IconCloudUpload,
  IconDeviceFloppy,
  IconDownload,
  IconHistory,
  IconPlugConnected,
  IconRefresh,
  IconTags,
} from "@tabler/icons-react";
import { stageTip } from "@/guide/catalog/types";
import type { SettingsState } from "@/stores/settings";
import { unisonFeatures } from "@/stores/settings-unison";

// -- Tips ---------------------------------------------------------------------

const tip = stageTip("export");

const unisonOn = (settings: SettingsState) => unisonFeatures(settings).enabled;

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
    gist: <>When Composer finds a MusicBrainz match, Fill adds album, songwriters and ISRC.</>,
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
    appliesWhen: unisonOn,
    icon: IconPlugConnected,
    title: "Connect to Unison",
    gist: <>Click Connect to submit under Share on Unison and sign in with Better Lyrics.</>,
  }),
  tip({
    id: "unisonSubmit",
    tier: "pro",
    appliesWhen: unisonOn,
    icon: IconCloudUpload,
    title: "Share it on Unison",
    gist: <>Submit once every check in the panel passes.</>,
  }),
  tip({
    id: "unisonUpdate",
    tier: "pro",
    appliesWhen: unisonOn,
    icon: IconRefresh,
    title: "Send an update",
    gist: <>Fixed something? Send update sends it as a new revision.</>,
  }),
  tip({
    id: "unisonHistory",
    tier: "pro",
    appliesWhen: unisonOn,
    icon: IconHistory,
    title: "Read the history",
    gist: <>Open History to see what changed in each revision.</>,
  }),
];

// -- Exports ------------------------------------------------------------------

export { EXPORT_TIPS };
