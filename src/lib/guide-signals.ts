import { hasKeyboard } from "@/lib/keyboard-presence";
import type { GuideEvent, GuideSignal } from "@/domain/guide/model";
import { firesOn } from "@/domain/guide/triggers";
import { GUIDE_NUDGE_TRIGGERS } from "@/guide/catalog/nudge-triggers";
import { GUIDE_SIGNAL_OUTCOMES } from "@/guide/catalog/signal-outcomes";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { type ProjectGuideFacts, useGuideStore } from "@/stores/guide";

// -- Types --------------------------------------------------------------------

interface PendingNudge {
  id: string;
  key?: string;
}

// -- Constants ----------------------------------------------------------------

const EVENT_WINDOW_MS = 5 * 60_000;
const MAX_EVENTS = 200;
const RESOLVED_BY = new Map(GUIDE_NUDGE_TRIGGERS.map((nudge) => [nudge.id, nudge.resolvedBy]));

// -- State --------------------------------------------------------------------

let events: GuideEvent[] = [];
let pending: readonly PendingNudge[] = [];
const retiredThisSession = new Set<string>();
const listeners = new Set<() => void>();

// -- Helpers ------------------------------------------------------------------

function setPending(next: readonly PendingNudge[]): void {
  pending = next;
  for (const listener of listeners) listener();
}

function remember(event: GuideEvent): void {
  const fresh = events.filter((past) => event.at - past.at < EVENT_WINDOW_MS);
  if (fresh.length >= MAX_EVENTS) fresh.shift();
  fresh.push(event);
  events = fresh;
}

function firedNudges(now: number): PendingNudge[] {
  const state = useGuideStore.getState();
  const seen = new Set(state.seenNudges);
  const muted = new Set(state.mutedCategories);
  const learned = new Set(state.learnedSignals);
  return GUIDE_NUDGE_TRIGGERS.filter(
    (nudge) =>
      !retiredThisSession.has(nudge.id) &&
      !seen.has(nudge.id) &&
      !muted.has(nudge.category) &&
      !(nudge.needsKeyboard && !hasKeyboard()) &&
      !(nudge.resolvedBy && learned.has(nudge.resolvedBy)) &&
      firesOn(nudge.trigger, events, now),
  ).map((nudge) => ({ id: nudge.id, key: events.findLast((event) => event.signal === nudge.trigger.signal)?.key }));
}

// -- API ----------------------------------------------------------------------

// Called from event handlers only, never from a frame callback: it may write the guide store.
function noteGuideSignal(signal: GuideSignal, key?: string): void {
  const now = performance.now();
  remember({ signal, at: now, key });
  const taught = new Set<GuideSignal>([signal, ...(GUIDE_SIGNAL_OUTCOMES[signal] ?? [])]);
  const { learnSignal } = useGuideStore.getState();
  const alreadyLearned = new Set(useGuideStore.getState().learnedSignals);
  for (const learned of taught) if (!alreadyLearned.has(learned)) learnSignal(learned);
  const resolved = pending.filter((queued) => {
    const resolvedBy = RESOLVED_BY.get(queued.id);
    const done = resolvedBy !== undefined && taught.has(resolvedBy);
    if (done) retiredThisSession.add(queued.id);
    return !done;
  });
  const fired = firedNudges(now);
  // Fired nudges wait for a quiet moment; they count as seen only once shown (markGuideNudgeShown).
  for (const nudge of fired) retiredThisSession.add(nudge.id);
  if (fired.length > 0 || resolved.length !== pending.length) setPending([...resolved, ...fired]);
}

function lastGuideSignalAt(): number {
  return events.at(-1)?.at ?? Number.NEGATIVE_INFINITY;
}

function noteGuideProjectFact(fact: keyof ProjectGuideFacts): void {
  const projectId = openProjectIdSnapshot();
  if (projectId) useGuideStore.getState().noteProjectFact(projectId, fact);
}

function noteGuideExport(): void {
  noteGuideSignal("export.get");
  noteGuideProjectFact("exported");
}

// A nudge shows once, ever: from the moment it is on screen, whether it is then taken, waved off or folded away.
function markGuideNudgeShown(id: string): void {
  if (!useGuideStore.getState().seenNudges.includes(id)) useGuideStore.getState().markNudgeSeen(id);
}

// Start over wipes the session too, or a hint that already fired this session could never come back.
function startGuideOver(): void {
  useGuideStore.setState({ learnedSignals: [], mutedCategories: [], seenNudges: [], showAll: false });
  retiredThisSession.clear();
  events = [];
  setPending([]);
}

// Muting a category also takes back its hints still waiting to show.
function muteGuideCategory(category: string): void {
  useGuideStore.getState().muteCategory(category);
  const muted = new Set(GUIDE_NUDGE_TRIGGERS.filter((nudge) => nudge.category === category).map((nudge) => nudge.id));
  for (const id of muted) retiredThisSession.add(id);
  if (pending.some((queued) => muted.has(queued.id))) setPending(pending.filter((queued) => !muted.has(queued.id)));
}

function resolveGuideNudge(id: string): void {
  retiredThisSession.add(id);
  if (pending.some((queued) => queued.id === id)) setPending(pending.filter((queued) => queued.id !== id));
}

function pendingGuideNudges(): readonly PendingNudge[] {
  return pending;
}

function subscribeGuideNudges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// -- Exports ------------------------------------------------------------------

export type { PendingNudge };
export {
  lastGuideSignalAt,
  markGuideNudgeShown,
  muteGuideCategory,
  noteGuideExport,
  noteGuideProjectFact,
  noteGuideSignal,
  pendingGuideNudges,
  resolveGuideNudge,
  startGuideOver,
  subscribeGuideNudges,
};
