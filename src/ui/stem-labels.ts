import type { Stem } from "@/audio/separation/types";
import { type Icon, IconMicrophone, IconMusic, IconWaveSine } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

const STEMS: readonly Stem[] = ["original", "vocals", "instrumental"];

const STEM_LABELS: Record<Stem, string> = {
  original: "Original",
  vocals: "Vocals",
  instrumental: "Instrumental",
};

const STEM_ICONS: Record<Stem, Icon> = {
  original: IconWaveSine,
  vocals: IconMicrophone,
  instrumental: IconMusic,
};

// -- Exports ------------------------------------------------------------------

export { STEMS, STEM_ICONS, STEM_LABELS };
