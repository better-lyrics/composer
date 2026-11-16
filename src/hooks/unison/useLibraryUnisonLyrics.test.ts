import { QueryClient } from "@tanstack/react-query";
import { unisonQueryKeys } from "@/hooks/unison/query-keys";
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

function lyricBy(id: number, keyId: string): UnisonLyric {
  return {
    id,
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
    createdAt: 1_758_900_000,
    userVote: null,
    submitter: {
      keyId,
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

function stubUnison(
  pages: readonly (readonly number[])[],
  lastPage = false,
): { minePages: number; lyricReads: number[] } {
  const calls = { minePages: 0, lyricReads: [] as number[] };
  vi.stubGlobal("fetch", async (url: string) => {
    const { pathname } = new URL(url);
    if (pathname.endsWith("/lyrics/mine")) {
      calls.minePages += 1;
      const ids = pages[calls.minePages - 1] ?? [1000 + calls.minePages];
      const ended = lastPage && calls.minePages >= pages.length;
      return Response.json({
        success: true,
        data: ids.map(mineItem),
        nextCursor: ended ? null : `page-${calls.minePages + 1}`,
      });
    }
    const id = Number(pathname.split("/").at(-1));
    if (id === SUGGESTION_ID || id === OWN_ID) {
      calls.lyricReads.push(id);
      return Response.json({ success: true, data: lyricBy(id, id === OWN_ID ? OWN_KEY : OWNER_KEY) });
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
    const calls = stubUnison([[OWN_ID]]);
    const queryClient = new QueryClient();
    const result = await fetchMineForLibrary(
      queryClient,
      [String(OWN_ID), String(SUGGESTION_ID)],
      false,
      false,
      new AbortController().signal,
      OWN_KEY,
    );

    expect(calls).toEqual({ minePages: 1, lyricReads: [SUGGESTION_ID] });
    expect(queryClient.getQueryData(unisonQueryKeys.lyric(SUGGESTION_ID))).toMatchObject({ id: SUGGESTION_ID });
    expect([...result.suggestionIds]).toEqual([String(SUGGESTION_ID)]);
  });

  it("counts an own lyric past the first page as found without reading more pages", async () => {
    const calls = stubUnison([[1001]]);
    const result = await fetchMineForLibrary(
      new QueryClient(),
      [String(OWN_ID)],
      false,
      false,
      new AbortController().signal,
      OWN_KEY,
    );

    expect(calls).toEqual({ minePages: 1, lyricReads: [OWN_ID] });
    expect(result.readById.map((lyric) => lyric.id)).toEqual([OWN_ID]);
    expect(result.suggestionIds.size).toBe(0);
  });

  it("regression: never reads an own lyric by id when a later page lists it", async () => {
    const calls = stubUnison([[1001], [OWN_ID]], true);
    const result = await fetchMineForLibrary(
      new QueryClient(),
      [String(OWN_ID), String(SUGGESTION_ID)],
      true,
      false,
      new AbortController().signal,
      OWN_KEY,
    );

    expect(calls.lyricReads).toEqual([SUGGESTION_ID]);
    expect([...result.suggestionIds]).toEqual([String(SUGGESTION_ID)]);
  });
});
