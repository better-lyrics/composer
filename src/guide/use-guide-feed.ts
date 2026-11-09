import type { Journey } from "@/domain/guide/journey";
import { GUIDE_TIER_ORDER, type GuideStage, type GuideTierId, type TierStatus } from "@/domain/guide/model";
import { JOURNEY_COPY, STAGE_NAMES } from "@/guide/catalog/journey";
import { GUIDE_NUDGES } from "@/guide/catalog/nudges";
import { GUIDE_TIER_NAMES } from "@/guide/catalog/types";
import { dropPeeks, enqueuePeek } from "@/guide/peek-queue";
import { type PendingNudge, pendingGuideNudges, resolveGuideNudge, subscribeGuideNudges } from "@/lib/guide-signals";
import { isRestoringProject } from "@/lib/project-restore";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createElement, useEffect, useRef, useState, useSyncExternalStore } from "react";

// -- Types --------------------------------------------------------------------

interface EarnedTier {
  stage: GuideStage;
  tier: GuideTierId;
}

type StageTiers = ReadonlyMap<GuideStage, readonly TierStatus[]>;

// -- Constants ----------------------------------------------------------------

const RESTORE_SETTLE_MS = 1_000;

// -- State --------------------------------------------------------------------

let greetedThisSession = false;
let lastRestoreAt = Number.NEGATIVE_INFINITY;

// -- Helpers ------------------------------------------------------------------

function earnedKeys(tiers: StageTiers): Set<string> {
  const keys = new Set<string>();
  for (const [stage, statuses] of tiers) {
    for (const status of statuses) if (status.state === "earned") keys.add(`${stage}:${status.tier}`);
  }
  return keys;
}

function unlockedGist(stage: GuideStage, tier: GuideTierId, statuses: readonly TierStatus[]): string {
  const next = statuses.find(
    (status) => GUIDE_TIER_ORDER.indexOf(status.tier) > GUIDE_TIER_ORDER.indexOf(tier) && status.total > 0,
  )?.tier;
  const finished = `${STAGE_NAMES[stage]} ${GUIDE_TIER_NAMES[tier].toLowerCase()}, done.`;
  return next ? `${finished} ${GUIDE_TIER_NAMES[next]} is open` : `${finished} Every ${STAGE_NAMES[stage]} tip learned`;
}

// -- Hooks --------------------------------------------------------------------

function useNudgeFeed(): readonly PendingNudge[] {
  const pending = useSyncExternalStore(subscribeGuideNudges, pendingGuideNudges, pendingGuideNudges);
  useEffect(() => {
    for (const queued of pending) {
      const nudge = GUIDE_NUDGES.find((candidate) => candidate.id === queued.id);
      if (nudge?.available?.() === false) resolveGuideNudge(nudge.id);
      else if (nudge) enqueuePeek({ id: `nudge:${nudge.id}`, kind: "tip", gist: nudge.peek, nudgeId: nudge.id });
    }
    dropPeeks((peek) => !peek.nudgeId || pending.some((queued) => queued.id === peek.nudgeId));
  }, [pending]);
  return pending;
}

// Opening a project fills the stores in one synchronous restore; steps it brings back done are not news.
function useRestoreWatch(): void {
  useEffect(() => {
    const noteRestore = () => {
      if (isRestoringProject()) lastRestoreAt = performance.now();
    };
    const stopProject = useProjectStore.subscribe(noteRestore);
    const stopAudio = useAudioStore.subscribe(noteRestore);
    return () => {
      stopProject();
      stopAudio();
    };
  }, []);
}

function useJourneyFeed(journey: Journey, projectId: string | undefined, firstVisit: boolean): void {
  useRestoreWatch();
  const seen = useRef<{ projectId?: string; doneCount: number }>({ projectId, doneCount: journey.doneCount });
  useEffect(() => {
    const before = seen.current;
    const restored = performance.now() - lastRestoreAt < RESTORE_SETTLE_MS;
    seen.current = { projectId, doneCount: journey.doneCount };
    if (restored || before.projectId !== projectId || journey.doneCount !== before.doneCount + 1) return;
    const finished = journey.steps.findLast((step) => step.done);
    if (!finished) return;
    const next = journey.current ? JOURNEY_COPY[journey.current].next : null;
    const gist = next
      ? createElement("span", null, `${JOURNEY_COPY[finished.id].done} Next: `, next)
      : JOURNEY_COPY[finished.id].done;
    enqueuePeek({ id: `done:${projectId}:${journey.doneCount}`, kind: "done", gist });
  }, [journey, projectId]);

  useEffect(() => {
    if (greetedThisSession || !firstVisit || !journey.current) return;
    greetedThisSession = true;
    enqueuePeek({ id: "next:greeting", kind: "next", gist: JOURNEY_COPY[journey.current].next });
  }, [firstVisit, journey]);
}

// A tier earned while you work earns its milestone; tiers already earned before this session stay quiet.
function useMilestoneFeed(tiers: StageTiers) {
  const earnedBefore = useRef(earnedKeys(tiers));
  const [milestone, setMilestone] = useState<EarnedTier | null>(null);
  useEffect(() => {
    const now = earnedKeys(tiers);
    for (const key of now) {
      if (earnedBefore.current.has(key)) continue;
      const [stage, tier] = key.split(":") as [GuideStage, GuideTierId];
      setMilestone({ stage, tier });
      enqueuePeek({ id: `unlocked:${key}`, kind: "unlocked", gist: unlockedGist(stage, tier, tiers.get(stage) ?? []) });
    }
    earnedBefore.current = now;
  }, [tiers]);
  return { milestone, clearMilestone: () => setMilestone(null) };
}

// -- Exports ------------------------------------------------------------------

export { useJourneyFeed, useMilestoneFeed, useNudgeFeed };
export type { EarnedTier, StageTiers };
