import { PEEK_COOLDOWN_MS, canPeek } from "@/domain/guide/peek-gate";
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
function tryShowPeek(busy: boolean, now: number): number | null {
  if (state.showing || state.waiting.length === 0) return null;
  if (!canPeek({ now, busy, lastPeekAt, peeksThisSession })) {
    return !busy && lastPeekAt !== undefined ? Math.max(0, lastPeekAt + PEEK_COOLDOWN_MS - now) : null;
  }
  const [head, ...rest] = state.waiting;
  lastPeekAt = now;
  peeksThisSession += 1;
  update({ ...state, showing: head, waiting: rest });
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
export type { PeekQueueState };
