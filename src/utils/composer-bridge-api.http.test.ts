import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { composeAbortSignals, getAudioFromBridge } from "@/utils/composer-bridge-api";

// -- composeAbortSignals ------------------------------------------------------

describe("composeAbortSignals", () => {
  it("returns the second signal verbatim when no first signal is provided", () => {
    const ctrl = new AbortController();
    expect(composeAbortSignals(undefined, ctrl.signal)).toBe(ctrl.signal);
  });

  describe("with AbortSignal.any available (modern browsers)", () => {
    it("aborts when the caller signal aborts", () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      expect(composed.aborted).toBe(false);
      caller.abort();
      expect(composed.aborted).toBe(true);
    });

    it("aborts when the timeout signal aborts", () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      timeout.abort();
      expect(composed.aborted).toBe(true);
    });

    it("starts already aborted if the caller signal is already aborted", () => {
      const caller = new AbortController();
      caller.abort();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      expect(composed.aborted).toBe(true);
    });
  });

  describe("with AbortSignal.any unavailable (older Safari fallback)", () => {
    let originalAny: typeof AbortSignal.any;

    beforeEach(() => {
      originalAny = AbortSignal.any;
      (AbortSignal as unknown as { any: unknown }).any = undefined;
    });

    afterEach(() => {
      (AbortSignal as unknown as { any: typeof AbortSignal.any }).any = originalAny;
    });

    it("aborts when the caller signal aborts (regression for the dropped-caller-signal bug)", () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      expect(composed.aborted).toBe(false);
      caller.abort();
      expect(composed.aborted).toBe(true);
    });

    it("aborts when the timeout signal aborts", () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      timeout.abort();
      expect(composed.aborted).toBe(true);
    });

    it("starts already aborted if the caller signal is already aborted at call time", () => {
      const caller = new AbortController();
      caller.abort();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      expect(composed.aborted).toBe(true);
    });

    it("starts already aborted if the timeout signal is already aborted at call time", () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      timeout.abort();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      expect(composed.aborted).toBe(true);
    });

    it("starts already aborted if both signals were aborted before composition", () => {
      const caller = new AbortController();
      caller.abort();
      const timeout = new AbortController();
      timeout.abort();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      expect(composed.aborted).toBe(true);
    });

    it("only aborts the returned signal once per source (does not blow up if both fire)", () => {
      const caller = new AbortController();
      const timeout = new AbortController();
      const composed = composeAbortSignals(caller.signal, timeout.signal);
      const handler = vi.fn();
      composed.addEventListener("abort", handler);
      caller.abort();
      timeout.abort();
      // The composed signal is a single AbortController under the hood; it
      // fires "abort" exactly once even if both upstream signals fire.
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});

// -- getAudioFromBridge -------------------------------------------------------

describe("getAudioFromBridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubAudioResponse(headers: Record<string, string>): void {
    vi.stubGlobal("fetch", async (): Promise<Response> => {
      const responseHeaders = new Headers({ "content-type": "audio/opus", ...headers });
      return new Response(new TextEncoder().encode("opus-bytes").buffer, { headers: responseHeaders });
    });
  }

  it("reads isrc from the x-track-isrc header", async () => {
    stubAudioResponse({ "x-track-isrc": encodeURIComponent("GBARL9300135") });

    const audio = await getAudioFromBridge("http://localhost:7777", "dQw4w9WgXcQ");

    expect(audio.isrc).toBe("GBARL9300135");
  });

  it("leaves isrc undefined when the x-track-isrc header is absent", async () => {
    stubAudioResponse({ "x-track-title": encodeURIComponent("Never Gonna Give You Up") });

    const audio = await getAudioFromBridge("http://localhost:7777", "dQw4w9WgXcQ");

    expect(audio.isrc).toBeUndefined();
    expect(audio.title).toBe("Never Gonna Give You Up");
  });

  it("decodes percent-encoded title/artist/album/isrc together", async () => {
    stubAudioResponse({
      "x-track-title": encodeURIComponent("Never Gonna Give You Up"),
      "x-track-artist": encodeURIComponent("Rick Astley"),
      "x-track-album": encodeURIComponent("Whenever You Need Somebody"),
      "x-track-isrc": encodeURIComponent("GBARL9300135"),
    });

    const audio = await getAudioFromBridge("http://localhost:7777", "dQw4w9WgXcQ");

    expect(audio.title).toBe("Never Gonna Give You Up");
    expect(audio.artist).toBe("Rick Astley");
    expect(audio.album).toBe("Whenever You Need Somebody");
    expect(audio.isrc).toBe("GBARL9300135");
  });
});
