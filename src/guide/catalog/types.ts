import type { GuideNudgeEntry, GuideSignal, GuideStage, GuideTierId, GuideTipEntry } from "@/domain/guide/model";
import type { SettingsState } from "@/stores/settings";
import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

// Where a tip or step happens: the tab and the control the Guide points at when you click it.
interface GuideSpotTarget {
  stage: GuideStage;
  spot: string;
  text: React.ReactNode;
}

interface GuideTip extends GuideTipEntry {
  icon: Icon;
  title: string;
  gist: React.ReactNode;
  spot?: GuideSpotTarget;
  appliesWhen?: (settings: SettingsState) => boolean;
  needs?: GuideSignal;
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
  available?: () => boolean;
}

type GuideNudgeCopy = Omit<GuideNudge, keyof GuideNudgeEntry>;

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
export type { GuideNudge, GuideNudgeCopy, GuideSpotTarget, GuideTip };
