import type { ProjectTab } from "@/domain/project/tab";

// -- Types --------------------------------------------------------------------

type GuideTierId = "basics" | "further" | "pro";

type GuideStage = ProjectTab;

type GuideSignal = `${string}.${string}`;

interface GuideTipEntry {
  id: string;
  stage: GuideStage;
  tier: GuideTierId;
  learnedBy: GuideSignal;
}

interface GuideTrigger {
  signal: GuideSignal;
  count: number;
  windowMs: number;
  // Numeric keys within this distance of the latest one count as the same, such as times a second apart.
  near?: number;
}

interface GuideNudgeEntry {
  id: string;
  stage: GuideStage;
  category: string;
  trigger: GuideTrigger;
  resolvedBy?: GuideSignal;
  // Shown in place, next to the element marked data-guide-spot with this name, instead of through the orb.
  spot?: string;
  // Teaches a key or a modifier, so it waits until the device shows it has a keyboard.
  needsKeyboard?: boolean;
}

interface GuideEvent {
  signal: GuideSignal;
  at: number;
  key?: string;
}

type TierState = "earned" | "open" | "locked";

interface TierStatus {
  tier: GuideTierId;
  total: number;
  learned: number;
  state: TierState;
}

// -- Constants ----------------------------------------------------------------

const GUIDE_TIER_ORDER: readonly GuideTierId[] = ["basics", "further", "pro"];

// -- Exports ------------------------------------------------------------------

export { GUIDE_TIER_ORDER };
export type {
  GuideEvent,
  GuideNudgeEntry,
  GuideSignal,
  GuideStage,
  GuideTierId,
  GuideTipEntry,
  GuideTrigger,
  TierState,
  TierStatus,
};
