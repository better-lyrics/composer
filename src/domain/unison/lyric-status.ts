// -- Types ---------------------------------------------------------------------

type UnisonStatus = "live" | "sealed" | "hidden" | "pending" | "declined" | "removed";

interface UnisonLyricSnapshot {
  hidden: boolean;
  marks?: readonly { type: string }[];
  revision?: { pending: unknown; lastRejected: unknown };
}

// -- Functions -----------------------------------------------------------------

function isSealed(lyric: Pick<UnisonLyricSnapshot, "marks">): boolean {
  return lyric.marks?.some((mark) => mark.type === "seal") ?? false;
}

function unisonStatus(lyric: UnisonLyricSnapshot | null): UnisonStatus {
  if (!lyric) return "removed";
  if (lyric.revision?.pending) return "pending";
  if (lyric.revision?.lastRejected) return "declined";
  if (lyric.hidden) return "hidden";
  if (isSealed(lyric)) return "sealed";
  return "live";
}

function formatScore(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

// -- Exports -------------------------------------------------------------------

export type { UnisonLyricSnapshot, UnisonStatus };
export { formatScore, isSealed, unisonStatus };
