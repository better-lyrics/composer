// -- Types --------------------------------------------------------------------

interface PeekMoment {
  now: number;
  busy: boolean;
  lastPeekAt?: number;
  peeksThisSession: number;
}

// -- Constants ----------------------------------------------------------------

const PEEK_COOLDOWN_MS = 3 * 60_000;
const PEEK_SESSION_CAP = 6;
const PEEK_VISIBLE_MS = 5_000;

// -- Rules --------------------------------------------------------------------

function canPeek({ now, busy, lastPeekAt, peeksThisSession }: PeekMoment): boolean {
  if (busy || peeksThisSession >= PEEK_SESSION_CAP) return false;
  return lastPeekAt === undefined || now - lastPeekAt >= PEEK_COOLDOWN_MS;
}

// -- Exports ------------------------------------------------------------------

export { PEEK_COOLDOWN_MS, PEEK_VISIBLE_MS, canPeek };
