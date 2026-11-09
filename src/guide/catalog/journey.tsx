import type { JourneyStepId } from "@/domain/guide/journey";
import type { GuideStage } from "@/domain/guide/model";
import { IMPORT_TIPS } from "@/guide/catalog/import";
import { keys } from "@/guide/catalog/keys";
import { SYNC_TIPS } from "@/guide/catalog/sync";
import type { GuideSpotTarget, GuideTip } from "@/guide/catalog/types";

// -- Types --------------------------------------------------------------------

interface JourneyStepCopy {
  title: string;
  stage: GuideStage;
  next: React.ReactNode;
  done: string;
  spot?: GuideSpotTarget;
}

// -- Helpers ----------------------------------------------------------------

// A step points where its first tip does, so the two never disagree.
const tipSpot = (tips: readonly GuideTip[], id: string) => tips.find((tip) => tip.id === id)?.spot;

// -- Copy ---------------------------------------------------------------------

const JOURNEY_COPY: Record<JourneyStepId, JourneyStepCopy> = {
  song: {
    title: "Add a song",
    stage: "import",
    next: <>Drop in an audio file or paste a YouTube link</>,
    done: "Song added.",
    spot: tipSpot(IMPORT_TIPS, "audio"),
  },
  lyrics: {
    title: "Add your lyrics",
    stage: "edit",
    next: <>Paste your lyrics in Edit, one line per line</>,
    done: "Lyrics are in.",
    spot: tipSpot(IMPORT_TIPS, "lyrics"),
  },
  sync: {
    title: "Sync your lyrics",
    stage: "sync",
    next: <>Play the song and press {keys("sync.tap")} as each word is sung</>,
    done: "Every line has timing.",
    spot: tipSpot(SYNC_TIPS, "tap"),
  },
  fineTune: {
    title: "Fine-tune on the Timeline",
    stage: "timeline",
    next: <>Open the Timeline and drag any word that's off</>,
    done: "Timeline checked.",
  },
  preview: {
    title: "Watch it in Preview",
    stage: "preview",
    next: <>Open Preview to see your lyrics the way listeners will</>,
    done: "Preview checked.",
  },
  export: {
    title: "Export your TTML",
    stage: "export",
    next: <>Copy or download your TTML from Export</>,
    done: "Exported. Nice work.",
  },
};

// Lyrics that arrive with their timing finish two steps at once.
const IMPORTED_TIMING_DONE = "Your lyrics came with timing.";

const STAGE_NAMES: Record<GuideStage, string> = {
  import: "Import",
  edit: "Edit",
  languages: "Languages",
  sync: "Sync",
  timeline: "Timeline",
  preview: "Preview",
  export: "Export",
};

const STAGE_HELP_SECTIONS: Record<GuideStage, string> = {
  import: "importing",
  edit: "editing",
  languages: "editing",
  sync: "syncing",
  timeline: "timeline",
  preview: "preview",
  export: "exporting",
};

// -- Exports ------------------------------------------------------------------

export { IMPORTED_TIMING_DONE, JOURNEY_COPY, STAGE_HELP_SECTIONS, STAGE_NAMES };
