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
  const { mutedCategories, learnedSignals } = useGuideStore.getState();
  return GUIDE_NUDGE_TRIGGERS.filter(
    (nudge) =>
      !retiredThisSession.has(nudge.id) &&
      !mutedCategories.includes(nudge.category) &&
      !(nudge.resolvedBy && learnedSignals.includes(nudge.resolvedBy)) &&
      firesOn(nudge.trigger, events, now),
  ).map((nudge) => ({ id: nudge.id, key: events.findLast((event) => event.signal === nudge.trigger.signal)?.key }));
}

// -- API ----------------------------------------------------------------------

// Called from event handlers only, never from a frame callback: it may write the guide store.
function noteGuideSignal(signal: GuideSignal, key?: string): void {
  const now = performance.now();
  remember({ signal, at: now, key });
  const taught = [signal, ...(GUIDE_SIGNAL_OUTCOMES[signal] ?? [])];
  for (const learned of taught) {
    const { learnedSignals, learnSignal } = useGuideStore.getState();
    if (!learnedSignals.includes(learned)) learnSignal(learned);
  }
  const resolved = pending.filter((queued) => {
    const resolvedBy = GUIDE_NUDGE_TRIGGERS.find((nudge) => nudge.id === queued.id)?.resolvedBy;
    const done = resolvedBy !== undefined && taught.includes(resolvedBy);
    if (done) retiredThisSession.add(queued.id);
    return !done;
  });
  const fired = firedNudges(now);
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

// A nudge shows at most once a session, whether the user took it, waved it off or did the thing on their own.
function noteGuideExport(): void {
  noteGuideSignal("export.get");
  noteGuideProjectFact("exported");
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

export {
  lastGuideSignalAt,
  noteGuideExport,
  noteGuideProjectFact,
  noteGuideSignal,
  pendingGuideNudges,
  resolveGuideNudge,
  subscribeGuideNudges,
};
export type { PendingNudge };
