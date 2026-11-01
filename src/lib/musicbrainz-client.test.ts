import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMusicBrainz, resetMusicBrainzQueue } from "@/lib/musicbrainz-client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("fetchMusicBrainz", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMusicBrainzQueue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("spaces requests at least one second apart", async () => {
    const startedAt: number[] = [];
    vi.stubGlobal("fetch", async () => {
      startedAt.push(Date.now());
      return json({ ok: true });
    });
    const both = Promise.all([
      fetchMusicBrainz("https://musicbrainz.org/ws/2/a"),
      fetchMusicBrainz("https://musicbrainz.org/ws/2/b"),
    ]);
    await vi.runAllTimersAsync();
    await both;
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(1000);
  });

  it("retries a 503 once", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const responses = [json({}, 503), json({ ok: true })];
    vi.stubGlobal("fetch", async () => responses.shift());
    const result = fetchMusicBrainz("https://musicbrainz.org/ws/2/a");
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ ok: true });
  });

  describe("error paths", () => {
    it("rejects after a second 503", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("fetch", async () => json({}, 503));
      const assertion = expect(fetchMusicBrainz("https://musicbrainz.org/ws/2/a")).rejects.toThrow("503");
      await vi.runAllTimersAsync();
      await assertion;
    });

    it("never sends request headers", async () => {
      const inits: (RequestInit | undefined)[] = [];
      vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
        inits.push(init);
        return json({});
      });
      const result = fetchMusicBrainz("https://musicbrainz.org/ws/2/a");
      await vi.runAllTimersAsync();
      await result;
      expect(inits[0]?.headers).toBeUndefined();
    });

    it("rejects a queued request when aborted and keeps the queue moving", async () => {
      vi.stubGlobal("fetch", async () => json({ ok: true }));
      const controller = new AbortController();
      const first = fetchMusicBrainz("https://musicbrainz.org/ws/2/a");
      const queued = fetchMusicBrainz("https://musicbrainz.org/ws/2/b", controller.signal);
      const after = fetchMusicBrainz("https://musicbrainz.org/ws/2/c");
      controller.abort();
      const assertion = expect(queued).rejects.toThrow();
      await vi.runAllTimersAsync();
      await assertion;
      await expect(first).resolves.toEqual({ ok: true });
      await expect(after).resolves.toEqual({ ok: true });
    });
  });
});
