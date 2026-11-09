import type { GuideStage } from "@/domain/guide/model";
import { PEEK_COOLDOWN_MS, canPeek } from "@/domain/guide/peek-gate";
import { markGuideNudgeShown } from "@/lib/guide-signals";
import type { GuidePeek } from "@/ui/guide/peek";

// -- Types --------------------------------------------------------------------

interface PeekQueueState {
  showing: GuidePeek | null;
  waiting: readonly GuidePeek[];
  unread: readonly GuidePeek[];
}

// -- State --------------------------------------------------------------------

// Module state, not React state: the queue and the session cap outlive the editor screen remounting.
let state: PeekQueueState = { showing: null, waiting: [], unread: [] };
let lastPeekAt: number | undefined;
let peeksThisSession = 0;
const listeners = new Set<() => void>();

// -- Helpers ------------------------------------------------------------------

function update(next: PeekQueueState): void {
  state = next;
  for (const listener of listeners) listener();
}

const sameItem = (peek: GuidePeek) => (other: GuidePeek) => other.id === peek.id;

// -- API ----------------------------------------------------------------------

function enqueuePeek(peek: GuidePeek): void {
  const known =
    state.showing?.id === peek.id || state.waiting.some(sameItem(peek)) || state.unread.some(sameItem(peek));
  if (!known) update({ ...state, waiting: [...state.waiting, peek] });
}

// Returns the ms to wait before the next try when something waits behind the cooldown, else null.
// A peek about one tab waits until you are on it.
function tryShowPeek(busy: boolean, now: number, stage: GuideStage): number | null {
  const head = state.waiting.find((peek) => !peek.stage || peek.stage === stage);
  if (state.showing || !head) return null;
  // News and nudges answer something you just did, so they show now; the cooldown and cap only space out tips.
  const answersYou = head.kind === "done" || head.nudgeId !== undefined;
  const since = answersYou ? undefined : lastPeekAt;
  if (!canPeek({ now, busy, lastPeekAt: since, peeksThisSession: answersYou ? 0 : peeksThisSession })) {
    return !busy && lastPeekAt !== undefined ? Math.max(0, lastPeekAt + PEEK_COOLDOWN_MS - now) : null;
  }
  lastPeekAt = now;
  peeksThisSession += 1;
  update({ ...state, showing: head, waiting: state.waiting.filter((peek) => peek !== head) });
  if (head.nudgeId) markGuideNudgeShown(head.nudgeId);
  return null;
}

function foldPeek(): void {
  if (state.showing) update({ ...state, showing: null, unread: [...state.unread, state.showing] });
}

function dropPeeks(keep: (peek: GuidePeek) => boolean): void {
  const showing = state.showing && keep(state.showing) ? state.showing : null;
  const waiting = state.waiting.filter(keep);
  const unread = state.unread.filter(keep);
  if (showing !== state.showing || waiting.length !== state.waiting.length || unread.length !== state.unread.length) {
    update({ showing, waiting, unread });
  }
}

function markPeeksRead(): void {
  if (state.showing || state.waiting.length > 0 || state.unread.length > 0) {
    update({ showing: null, waiting: [], unread: [] });
  }
}

function peekQueueSnapshot(): PeekQueueState {
  return state;
}

function subscribePeekQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// -- Exports ------------------------------------------------------------------

export { dropPeeks, enqueuePeek, foldPeek, markPeeksRead, peekQueueSnapshot, subscribePeekQueue, tryShowPeek };
