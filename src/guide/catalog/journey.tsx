import type { JourneyStepId } from "@/domain/guide/journey";
import type { GuideStage } from "@/domain/guide/model";
import { keys } from "@/guide/catalog/keys";

// -- Types --------------------------------------------------------------------

interface JourneyStepCopy {
  title: string;
  stage: GuideStage;
  next: React.ReactNode;
  done: string;
}

// -- Copy ---------------------------------------------------------------------

const JOURNEY_COPY: Record<JourneyStepId, JourneyStepCopy> = {
  song: {
    title: "Add a song",
    stage: "import",
    next: <>Drop in an audio file or paste a YouTube link</>,
    done: "Song added.",
  },
  lyrics: {
    title: "Add your lyrics",
    stage: "edit",
    next: <>Paste your lyrics in Edit, one line per line</>,
    done: "Lyrics are in.",
  },
  sync: {
    title: "Sync your lyrics",
    stage: "sync",
    next: <>Play the song and press {keys("sync.tap")} as each word is sung</>,
    done: "Every line has timing.",
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

export { JOURNEY_COPY, STAGE_HELP_SECTIONS, STAGE_NAMES };
