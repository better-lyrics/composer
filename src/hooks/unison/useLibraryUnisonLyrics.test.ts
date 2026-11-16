import { fetchMineForLibrary } from "@/hooks/unison/useLibraryUnisonLyrics";
import type { UnisonLyric, UnisonMineItem } from "@/lib/unison/api-types";
import { clearUnisonSession, saveUnisonSession } from "@/lib/unison/session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const OWN_KEY = "a".repeat(64);
const OWNER_KEY = "b".repeat(64);
const OWN_ID = 11;
const SUGGESTION_ID = 4821;

// -- Helpers ------------------------------------------------------------------

function mineItem(id: number): UnisonMineItem {
  return {
    id,
    videoId: "hArb0urL1te",
    song: "Harbour Lights",
    artist: "Test Artist",
    duration: 200,
    format: "ttml",
    syncType: "richsync",
    score: 2,
    effectiveScore: 2,
    voteCount: 2,
    confidence: "low",
    createdAt: 1_758_900_000,
    hidden: false,
    userVote: null,
    revision: { revNo: 1, count: 1, pending: null, lastRejected: null, updatedAt: 0 },
  };
}

function someoneElsesLyric(): UnisonLyric {
  return {
    id: SUGGESTION_ID,
    videoId: "pAperLantrn",
    song: "Paper Lanterns",
    artist: "Hollow Coast",
    lyrics: "Paper lanterns over the bay",
    format: "plain",
    syncType: "plain",
    score: 5,
    effectiveScore: 5,
    voteCount: 5,
    confidence: "medium",
    hidden: false,
    userVote: null,
    submitter: {
      keyId: OWNER_KEY,
      displayName: "Mirelle",
      tier: null,
      level: 4,
      badgeCount: 0,
      topBadge: null,
      featured: [],
      avatarUrl: null,
      reputation: 1,
    },
    revision: { revNo: 3, count: 3, pending: null, lastRejected: null, updatedAt: 0 },
  };
}

function stubUnison(): { minePages: number; lyricReads: number } {
  const calls = { minePages: 0, lyricReads: 0 };
  vi.stubGlobal("fetch", async (url: string) => {
    const { pathname } = new URL(url);
    if (pathname.endsWith("/lyrics/mine")) {
      calls.minePages += 1;
      const items = calls.minePages === 1 ? [mineItem(OWN_ID)] : [mineItem(1000 + calls.minePages)];
      return Response.json({ success: true, data: items, nextCursor: `page-${calls.minePages + 1}` });
    }
    if (pathname.endsWith(`/lyrics/${SUGGESTION_ID}`)) {
      calls.lyricReads += 1;
      return Response.json({ success: true, data: someoneElsesLyric() });
    }
    throw new Error(`Unexpected request in the library reader test: ${pathname}`);
  });
  return calls;
}

// -- Tests --------------------------------------------------------------------

describe("fetchMineForLibrary", () => {
  beforeEach(() => {
    saveUnisonSession({
      token: "token-a",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      keyId: OWN_KEY,
      displayName: "Ren Okafor",
      avatarUrl: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearUnisonSession();
  });

  it("stops after the first page when the only other link is someone else's lyric", async () => {
    const calls = stubUnison();
    const result = await fetchMineForLibrary(
      [String(OWN_ID), String(SUGGESTION_ID)],
      false,
      false,
      new AbortController().signal,
      OWN_KEY,
    );

    expect(calls).toEqual({ minePages: 1, lyricReads: 1 });
    expect([...result.suggestionIds]).toEqual([String(SUGGESTION_ID)]);
  });
});
