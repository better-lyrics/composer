import type { GuideStage } from "@/domain/guide/model";
import { IconCheck, IconCompass, IconSparkles, IconStars, type Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type PeekKind = "next" | "tip" | "unlocked" | "done";

interface GuidePeek {
  id: string;
  kind: PeekKind;
  gist: React.ReactNode;
  nudgeId?: string;
  stage?: GuideStage;
}

// -- Constants ----------------------------------------------------------------

const PEEK_LABELS: Record<PeekKind, string> = { next: "Next", tip: "Tip", unlocked: "Unlocked", done: "Done" };

const PEEK_TONES: Record<PeekKind, string> = {
  next: "text-composer-accent-text",
  tip: "text-composer-accent-text",
  unlocked: "text-composer-positive",
  done: "text-composer-positive",
};

const PEEK_ICONS: Record<PeekKind, Icon> = {
  next: IconCompass,
  tip: IconSparkles,
  unlocked: IconStars,
  done: IconCheck,
};

// -- Exports ------------------------------------------------------------------

export { PEEK_ICONS, PEEK_LABELS, PEEK_TONES };
export type { GuidePeek };
