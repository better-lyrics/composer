import type { LastSeen, LastSeenLyric } from "@/domain/unison/updates-since";

// -- Constants -----------------------------------------------------------------

const LAST_SEEN_STORAGE_KEY = "composer.unison.last-seen.v1";
const LOG_PREFIX = "[UnisonLastSeen]";

// -- Parsing -------------------------------------------------------------------

function isLastSeenLyric(value: unknown): value is LastSeenLyric {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.revNo === "number" &&
    (candidate.rejectedRevNo === null || typeof candidate.rejectedRevNo === "number") &&
    typeof candidate.hidden === "boolean"
  );
}

function parseLastSeen(raw: string): LastSeen | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(LOG_PREFIX, "saved snapshot has an unknown shape, starting over");
      return null;
    }
    const lastSeen: LastSeen = {};
    for (const [lyricId, lyric] of Object.entries(parsed)) {
      if (isLastSeenLyric(lyric)) lastSeen[lyricId] = lyric;
    }
    return lastSeen;
  } catch (error) {
    console.warn(LOG_PREFIX, "saved snapshot is not valid JSON, starting over", error);
    return null;
  }
}

// -- Storage -------------------------------------------------------------------

function readLastSeen(): LastSeen | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
  } catch (error) {
    console.warn(LOG_PREFIX, "could not read the snapshot", error);
    return null;
  }
  return raw === null ? null : parseLastSeen(raw);
}

function writeLastSeen(lastSeen: LastSeen): void {
  try {
    localStorage.setItem(LAST_SEEN_STORAGE_KEY, JSON.stringify(lastSeen));
  } catch (error) {
    console.warn(LOG_PREFIX, "could not save the snapshot", error);
  }
}

// -- Exports -------------------------------------------------------------------

export { readLastSeen, writeLastSeen };
