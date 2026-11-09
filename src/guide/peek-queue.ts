import type { GuideStage } from "@/domain/guide/model";
import { PEEK_COOLDOWN_MS, PEEK_SESSION_CAP, canPeek } from "@/domain/guide/peek-gate";
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

const answersYou = (peek: GuidePeek) => peek.kind === "done" || peek.nudgeId !== undefined;

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
  if (state.showing) return null;
  const here = state.waiting.filter((peek) => !peek.stage || peek.stage === stage);
  // News and nudges answer something you just did, so they jump the line and skip the cooldown and cap.
  const head = here.find(answersYou) ?? here[0];
  if (!head) return null;
  const gated = !answersYou(head);
  if (
    !canPeek({ now, busy, lastPeekAt: gated ? lastPeekAt : undefined, peeksThisSession: gated ? peeksThisSession : 0 })
  ) {
    if (busy || lastPeekAt === undefined || peeksThisSession >= PEEK_SESSION_CAP) return null;
    return Math.max(0, lastPeekAt + PEEK_COOLDOWN_MS - now);
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

// Opening the card reads everything except nudges it cannot show yet: those keep waiting for their own turn.
function markPeeksRead(keep: (peek: GuidePeek) => boolean = () => false): void {
  const waiting = [state.showing, ...state.waiting, ...state.unread].filter(
    (peek): peek is GuidePeek => peek !== null && keep(peek),
  );
  if (state.showing || state.unread.length > 0 || waiting.length !== state.waiting.length) {
    update({ showing: null, waiting, unread: [] });
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
