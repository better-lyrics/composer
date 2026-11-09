import type { Journey } from "@/domain/guide/journey";
import { GUIDE_TIER_ORDER, type GuideStage, type GuideTierId, type TierStatus } from "@/domain/guide/model";
import { IMPORTED_TIMING_DONE, JOURNEY_COPY, STAGE_NAMES } from "@/guide/catalog/journey";
import { GUIDE_NUDGES } from "@/guide/catalog/nudges";
import { GUIDE_TIER_NAMES } from "@/guide/catalog/types";
import { dropPeeks, enqueuePeek } from "@/guide/peek-queue";
import { showSpotHint } from "@/guide/spot-hint-store";
import {
  lastGuideSignalAt,
  type PendingNudge,
  pendingGuideNudges,
  markGuideNudgeShown,
  resolveGuideNudge,
  subscribeGuideNudges,
  withdrawGuideNudge,
} from "@/lib/guide-signals";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { isRestoringProject } from "@/lib/project-restore";
import { lastQuietLearnAt } from "@/guide/use-guide-state-learning";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { useProjectStore } from "@/stores/project";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

// -- Types --------------------------------------------------------------------

interface EarnedTier {
  stage: GuideStage;
  tier: GuideTierId;
}

type StageTiers = ReadonlyMap<GuideStage, readonly TierStatus[]>;

// -- Constants ----------------------------------------------------------------

const RESTORE_SETTLE_MS = 1_000;
const QUIET_LEARN_ECHO_MS = 500;

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

function doneIds(steps: Journey["steps"]): string[] {
  return steps.flatMap((step) => (step.done ? [step.id] : []));
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
  const hintsOn = useSettingsStore((state) => state.guideHints);
  useEffect(() => {
    for (const queued of pending) {
      const nudge = GUIDE_NUDGES.find((candidate) => candidate.id === queued.id);
      // Hints turned off take back the ones still waiting, so they can fire once hints are back on.
      if (!hintsOn) withdrawGuideNudge(queued.id);
      else if (nudge?.available?.() === false) resolveGuideNudge(queued.id);
      else if (nudge?.spot && showSpotHint(nudge.spot, { id: nudge.id, icon: nudge.icon, text: nudge.peek })) {
        markGuideNudgeShown(nudge.id);
        resolveGuideNudge(nudge.id);
      } else if (nudge) {
        enqueuePeek({ id: `nudge:${nudge.id}`, kind: "tip", gist: nudge.peek, nudgeId: nudge.id, stage: nudge.stage });
      }
    }
    dropPeeks((peek) => !peek.nudgeId || pending.some((queued) => queued.id === peek.nudgeId));
  }, [pending, hintsOn]);
  return pending;
}

// Opening a project fills the stores in one synchronous restore; steps it brings back done are not news,
// unless the user just did something, such as dropping a song that starts a new project.
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
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let live = true;
    void getPersistenceSettled().then(() => live && setSettled(true));
    return () => {
      live = false;
    };
  }, []);

  const seen = useRef<{ projectId?: string; doneCount: number; done: readonly string[] }>({
    projectId,
    doneCount: journey.doneCount,
    done: doneIds(journey.steps),
  });
  useEffect(() => {
    const before = seen.current;
    const now = performance.now();
    const restored = now - lastRestoreAt < RESTORE_SETTLE_MS && now - lastGuideSignalAt() > RESTORE_SETTLE_MS;
    seen.current = { projectId, doneCount: journey.doneCount, done: doneIds(journey.steps) };
    // A step that came undone (a failed load fell back) takes back its news.
    const undone = new Set(journey.steps.filter((step) => !step.done).map((step) => `done:${projectId}:${step.id}`));
    dropPeeks((peek) => !undone.has(peek.id));
    const switched = before.projectId !== undefined && before.projectId !== projectId;
    // News belongs to its project: a switch drops what another project left waiting.
    if (switched) dropPeeks((peek) => !peek.id.startsWith("done:") || peek.id.startsWith(`done:${projectId}:`));
    if (!settled || restored || switched || journey.doneCount <= before.doneCount) return;
    // The news is about the step that just finished, not the furthest one already done.
    const doneBefore = new Set(before.done);
    const arrived = journey.steps.filter((step) => step.done && !doneBefore.has(step.id)).map((step) => step.id);
    const finished = arrived.at(-1);
    if (!finished) return;
    const cameSynced = arrived.includes("lyrics") && arrived.includes("sync");
    const done = cameSynced ? IMPORTED_TIMING_DONE : JOURNEY_COPY[finished].done;
    const next = journey.current ? JOURNEY_COPY[journey.current].title : null;
    const gist = next ? `${done} Next: ${next.charAt(0).toLowerCase()}${next.slice(1)}` : done;
    enqueuePeek({ id: `done:${projectId}:${finished}`, kind: "done", gist });
  }, [journey, projectId, settled]);

  useEffect(() => {
    if (!settled || greetedThisSession || !firstVisit || !journey.current) return;
    greetedThisSession = true;
    enqueuePeek({ id: "next:greeting", kind: "next", gist: JOURNEY_COPY[journey.current].next });
  }, [settled, firstVisit, journey]);
}

// A tier earned while you work earns its milestone; tiers already earned before this session stay quiet.
function useMilestoneFeed(tiers: StageTiers) {
  const earned = useMemo(() => earnedKeys(tiers), [tiers]);
  const [earnedBefore, setEarnedBefore] = useState(earned);
  const [milestone, setMilestone] = useState<(EarnedTier & { gist: string }) | null>(null);
  // Adjusting state while rendering, so the milestone and its peek come from the same render that earned it.
  if (earned !== earnedBefore) {
    setEarnedBefore(earned);
    // A tier finished by quietly noticing what is already on (spectrum, sidebar) is not something you just did.
    const byYourAction = performance.now() - lastQuietLearnAt() > QUIET_LEARN_ECHO_MS;
    const key = [...earned].findLast((candidate) => !earnedBefore.has(candidate));
    if (key && byYourAction) {
      const [stage, tier] = key.split(":") as [GuideStage, GuideTierId];
      setMilestone({ stage, tier, gist: unlockedGist(stage, tier, tiers.get(stage) ?? []) });
    }
  }
  useEffect(() => {
    if (milestone)
      enqueuePeek({ id: `unlocked:${milestone.stage}:${milestone.tier}`, kind: "unlocked", gist: milestone.gist });
  }, [milestone]);
  return { milestone, clearMilestone: () => setMilestone(null) };
}

// -- Exports ------------------------------------------------------------------

export type { EarnedTier, StageTiers };
export { useJourneyFeed, useMilestoneFeed, useNudgeFeed };
