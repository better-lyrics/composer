// -- Types ---------------------------------------------------------------------

interface UnisonMineSnapshot {
  id: number;
  hidden: boolean;
  revision: {
    revNo: number;
    pending: unknown;
    lastRejected: { revNo: number; reviewNote: string | null } | null;
    updatedAt: number;
  };
}

interface LastSeenLyric {
  revNo: number;
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

// -- Derivations ---------------------------------------------------------------

function lastSeenLyric(lyric: UnisonMineSnapshot): LastSeenLyric {
  return {
    revNo: lyric.revision.revNo,
    rejectedRevNo: lyric.revision.lastRejected?.revNo ?? null,
    hidden: lyric.hidden,
  };
}

function lyricUpdates(seen: LastSeenLyric, lyric: UnisonMineSnapshot): UnisonUpdate[] {
  const { revision } = lyric;
  const base = { lyricId: String(lyric.id), at: revision.updatedAt, reviewNote: null };
  const updates: UnisonUpdate[] = [];
  if (revision.revNo > seen.revNo) updates.push({ ...base, kind: "approved", revNo: revision.revNo });
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

function updatesSince(previous: LastSeen | null, current: readonly UnisonMineSnapshot[]): UnisonUpdate[] {
  if (!previous) return [];
  return current
    .flatMap((lyric) => {
      const seen = previous[String(lyric.id)];
      return seen ? lyricUpdates(seen, lyric) : [];
    })
    .toSorted((a, b) => b.at - a.at);
}

function lastSeenFrom(current: readonly UnisonMineSnapshot[], previous: LastSeen | null = null): LastSeen {
  const next: LastSeen = { ...previous };
  for (const lyric of current) next[String(lyric.id)] = lastSeenLyric(lyric);
  return next;
}

// -- Exports -------------------------------------------------------------------

export { lastSeenFrom, updatesSince };
export type { LastSeen, LastSeenLyric, UnisonMineSnapshot, UnisonUpdate, UnisonUpdateKind };
