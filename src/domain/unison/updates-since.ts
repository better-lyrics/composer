// -- Types ---------------------------------------------------------------------

interface UnisonMineSnapshot {
  id: number;
  hidden: boolean;
  revision: {
    revNo: number;
    pending: { revNo: number } | null;
    lastRejected: { revNo: number; reviewNote: string | null } | null;
    updatedAt: number;
  };
}

interface LastSeenLyric {
  revNo: number;
  pendingRevNo: number | null;
  rejectedRevNo: number | null;
  hidden: boolean;
}

type LastSeen = Record<string, LastSeenLyric>;

type UnisonUpdateKind = "approved" | "declined" | "hidden";

interface UnisonUpdate {
  lyricId: string;
  kind: UnisonUpdateKind;
  revNo: number;
  /** Unix seconds, from the lyric's revision bar. */
  at: number;
  reviewNote: string | null;
}

// -- Constants -----------------------------------------------------------------

const ALL_KINDS: ReadonlySet<UnisonUpdateKind> = new Set(["approved", "declined", "hidden"]);

// -- Derivations ---------------------------------------------------------------

function lastSeenLyric(lyric: UnisonMineSnapshot): LastSeenLyric {
  return {
    revNo: lyric.revision.revNo,
    pendingRevNo: lyric.revision.pending?.revNo ?? null,
    rejectedRevNo: lyric.revision.lastRejected?.revNo ?? null,
    hidden: lyric.hidden,
  };
}

function shownUpdates(
  seen: LastSeenLyric,
  lyric: UnisonMineSnapshot,
  kinds: ReadonlySet<UnisonUpdateKind>,
): UnisonUpdate[] {
  return lyricUpdates(seen, lyric).filter((update) => kinds.has(update.kind));
}

function lyricUpdates(seen: LastSeenLyric, lyric: UnisonMineSnapshot): UnisonUpdate[] {
  const { revision } = lyric;
  const base = { lyricId: String(lyric.id), at: revision.updatedAt, reviewNote: null };
  const updates: UnisonUpdate[] = [];
  if (seen.pendingRevNo !== null && revision.revNo >= seen.pendingRevNo)
    updates.push({ ...base, kind: "approved", revNo: revision.revNo });
  if (revision.lastRejected && revision.lastRejected.revNo !== seen.rejectedRevNo) {
    updates.push({
      ...base,
      kind: "declined",
      revNo: revision.lastRejected.revNo,
      reviewNote: revision.lastRejected.reviewNote,
    });
  }
  if (lyric.hidden && !seen.hidden) updates.push({ ...base, kind: "hidden", revNo: revision.revNo });
  return updates;
}

function updatesSince(
  previous: LastSeen | null,
  current: readonly UnisonMineSnapshot[],
  kinds: ReadonlySet<UnisonUpdateKind> = ALL_KINDS,
): UnisonUpdate[] {
  if (!previous) return [];
  return current
    .flatMap((lyric) => {
      const seen = previous[String(lyric.id)];
      return seen ? shownUpdates(seen, lyric, kinds) : [];
    })
    .toSorted((a, b) => b.at - a.at);
}

function lastSeenFrom(current: readonly UnisonMineSnapshot[], previous: LastSeen | null = null): LastSeen {
  const next: LastSeen = { ...previous };
  for (const lyric of current) next[String(lyric.id)] = lastSeenLyric(lyric);
  return next;
}

// A lyric with an update to show keeps its old entry until the notice is acted on; the rest advance,
// including updates of kinds nobody shows, which would otherwise hold the entry forever.
function settledLastSeen(
  previous: LastSeen | null,
  current: readonly UnisonMineSnapshot[],
  kinds: ReadonlySet<UnisonUpdateKind> = ALL_KINDS,
): LastSeen {
  const next: LastSeen = { ...previous };
  for (const lyric of current) {
    const seen = previous?.[String(lyric.id)];
    if (!seen || shownUpdates(seen, lyric, kinds).length === 0) next[String(lyric.id)] = lastSeenLyric(lyric);
  }
  return next;
}

// -- Exports -------------------------------------------------------------------

export type { LastSeen, LastSeenLyric, UnisonMineSnapshot, UnisonUpdate, UnisonUpdateKind };
export { lastSeenFrom, settledLastSeen, updatesSince };
