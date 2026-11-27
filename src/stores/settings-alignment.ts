import { RECOMMENDED_ALIGNMENT_MODEL } from "@/audio/alignment/hubertfa/model-manifest";

// -- Types ---------------------------------------------------------------------

interface AlignmentSettings {
  alignmentModelId: string;
  keepAlignmentModelLoaded: boolean;
  smoothAlignedWords: boolean;
}

// -- Defaults ------------------------------------------------------------------

const ALIGNMENT_SETTING_DEFAULTS: AlignmentSettings = {
  alignmentModelId: RECOMMENDED_ALIGNMENT_MODEL,
  keepAlignmentModelLoaded: false,
  smoothAlignedWords: true,
};

// -- Exports -------------------------------------------------------------------

export { ALIGNMENT_SETTING_DEFAULTS };
export type { AlignmentSettings };
