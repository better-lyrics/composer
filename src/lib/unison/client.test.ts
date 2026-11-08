import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNISON_BASE_URL, UnisonError, unisonFetch, unisonFetchPage } from "@/lib/unison/client";
import { clearUnisonSession, readUnisonSession, saveUnisonSession, subscribeUnisonSession } from "@/lib/unison/session";

interface RecordedCall {
  url: string;
  init: RequestInit;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const signIn = (token = "token-a") =>
  saveUnisonSession({
    token,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    keyId: "a".repeat(64),
    displayName: "Quiet Otter",
    avatarUrl: null,
  });

function stubFetch(respond: () => Response | Promise<Response>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  });
  return calls;
}

const headersOf = (call: RecordedCall) => new Headers(call.init.headers);

describe("unisonFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUnisonSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("unwraps the success envelope", async () => {
    const calls = stubFetch(() => json({ success: true, data: { nonce: "n", expiresAt: 1 } }));
    await expect(unisonFetch("/auth/challenge")).resolves.toEqual({ nonce: "n", expiresAt: 1 });
    expect(calls[0].url).toBe(`${UNISON_BASE_URL}/auth/challenge`);
    expect(calls[0].init.method).toBe("GET");
  });

  it("returns items and a string cursor for a page", async () => {
    stubFetch(() => json({ success: true, data: [{ id: 1 }], nextCursor: 20 }));
    await expect(unisonFetchPage("/lyrics/mine")).resolves.toEqual({ items: [{ id: 1 }], nextCursor: "20" });
  });

  it("sends the bearer token on auth calls", async () => {
    signIn("token-b");
    const calls = stubFetch(() => json({ success: true, data: {} }));
    await unisonFetch("/auth/me", { auth: true });
    expect(headersOf(calls[0]).get("authorization")).toBe("Bearer token-b");
  });

  describe("edge cases", () => {
    it("sends no content type on a bodiless DELETE", async () => {
      signIn();
      const calls = stubFetch(() => json({ success: true }));
      await expect(unisonFetch("/lyrics/4", { method: "DELETE", auth: true })).resolves.toBeUndefined();
      expect(headersOf(calls[0]).has("content-type")).toBe(false);
      expect(calls[0].init.body).toBeUndefined();
    });

    it("sends no bearer token on public calls", async () => {
      signIn();
      const calls = stubFetch(() => json({ success: true, data: {} }));
      await unisonFetch("/lyrics/4");
      expect(headersOf(calls[0]).has("authorization")).toBe(false);
    });
  });

  describe("error paths", () => {
    it("maps an error body to UnisonError with code and hint", async () => {
      stubFetch(() =>
        json({ success: false, error: "Not your submission", code: "NOT_OWNER", hint: "Only yours." }, 403),
      );
      const error = await unisonFetch("/lyrics/4").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UnisonError);
      expect(error).toMatchObject({
        code: "NOT_OWNER",
        status: 403,
        hint: "Only yours.",
        message: "Not your submission",
      });
    });

    it("uses the legacy error string as the code when no code is sent", async () => {
      stubFetch(() => json({ success: false, error: "ORIGIN_MISMATCH" }, 403));
      await expect(unisonFetch("/auth/session", { method: "POST", body: {} })).rejects.toMatchObject({
        code: "ORIGIN_MISMATCH",
        status: 403,
        hint: undefined,
      });
    });

    it("maps a non-JSON error body to a generic code with the status", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      stubFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));
      await expect(unisonFetch("/lyrics/4")).rejects.toMatchObject({ code: "HTTP_ERROR", status: 502 });
    });

    it("throws AUTH_REQUIRED without fetching when signed out", async () => {
      const calls = stubFetch(() => json({ success: true, data: {} }));
      await expect(unisonFetch("/auth/me", { auth: true })).rejects.toMatchObject({
        code: "AUTH_REQUIRED",
        status: 401,
      });
      expect(calls).toHaveLength(0);
    });

    it("clears the session and notifies subscribers on a 401", async () => {
      signIn();
      const listener = vi.fn();
      const unsubscribe = subscribeUnisonSession(listener);
      stubFetch(() => json({ success: false, error: "INVALID_TOKEN" }, 401));
      await expect(unisonFetch("/auth/me", { auth: true })).rejects.toMatchObject({ status: 401 });
      expect(readUnisonSession()).toBeNull();
      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it("keeps a newer session when a 401 answers an older token", async () => {
      signIn("old");
      stubFetch(() => {
        signIn("new");
        return json({ success: false, error: "INVALID_TOKEN" }, 401);
      });
      await expect(unisonFetch("/auth/me", { auth: true })).rejects.toMatchObject({ status: 401 });
      expect(readUnisonSession()?.token).toBe("new");
    });

    it("lets an AbortError through untouched", async () => {
      const abort = new DOMException("aborted", "AbortError");
      vi.stubGlobal("fetch", async () => {
        throw abort;
      });
      const controller = new AbortController();
      await expect(unisonFetch("/lyrics/4", { signal: controller.signal })).rejects.toBe(abort);
    });
  });

  describe("invariants", () => {
    it("never logs the token", async () => {
      signIn("secret-token");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      stubFetch(() => new Response("oops", { status: 500 }));
      await unisonFetch("/auth/me", { auth: true }).catch(() => undefined);
      expect(JSON.stringify([warn.mock.calls, error.mock.calls])).not.toContain("secret-token");
    });

    it("keeps the session on a non-401 failure", async () => {
      signIn();
      stubFetch(() => json({ success: false, error: "Rate limited", code: "RATE_LIMITED" }, 429));
      await expect(unisonFetch("/lyrics/submit", { method: "POST", body: {}, auth: true })).rejects.toMatchObject({
        code: "RATE_LIMITED",
      });
      expect(readUnisonSession()).not.toBeNull();
    });
  });
});
