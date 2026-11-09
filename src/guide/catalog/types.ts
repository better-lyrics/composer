import type { GuideNudgeEntry, GuideStage, GuideTierId, GuideTipEntry } from "@/domain/guide/model";
import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface GuideTip extends GuideTipEntry {
  icon: Icon;
  title: string;
  gist: React.ReactNode;
}

interface GuideNudgeAction {
  label: string;
  run: (key: string | undefined) => void;
}

interface GuideNudge extends GuideNudgeEntry {
  icon: Icon;
  title: string;
  body: React.ReactNode;
  peek: React.ReactNode;
  primary?: GuideNudgeAction;
}

// -- Constants ----------------------------------------------------------------

const GUIDE_TIER_NAMES: Record<GuideTierId, string> = {
  basics: "Basics",
  further: "Going further",
  pro: "Pro tools",
};

// -- Helpers ------------------------------------------------------------------

// Every tip is learned by the signal named after its stage and id.
const stageTip =
  (stage: GuideStage) =>
  (entry: Omit<GuideTip, "stage" | "learnedBy">): GuideTip => ({ ...entry, stage, learnedBy: `${stage}.${entry.id}` });

// -- Exports ------------------------------------------------------------------

export { GUIDE_TIER_NAMES, stageTip };
export type { GuideNudge, GuideNudgeAction, GuideTip };
