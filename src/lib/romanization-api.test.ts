import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RateLimitError,
  RomanizationApiError,
  ServiceUnavailableError,
  TurnstileError,
  romanizeLines,
} from "@/lib/romanization-api";

// TDD policy: the module under test owns fetch. We stub the global so the test
// observes a real Request shape and consumes a real Response object, rather than
// mocking the parser itself. This keeps the parsing/error-mapping code paths real.

const ENDPOINT = "https://composer-romanization-api.boidu.dev/v1/romanize";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makePayload() {
  return {
    scheme: "ja-Latn-hepburn",
    lines: [{ id: "L1", text: "夜だけど", words: ["夜", "だけど"] }],
    turnstileToken: "tok",
  };
}

describe("romanizeLines", () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the expected JSON shape and headers", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ results: [], errors: [] }));
    await romanizeLines(makePayload());
    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((init?.headers as Record<string, string>)["Cf-Turnstile-Token"]).toBe("tok");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      scheme: "ja-Latn-hepburn",
      lines: [{ id: "L1", text: "夜だけど", words: ["夜", "だけど"] }],
    });
  });

  it("omits scheme from the body when undefined", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ results: [], errors: [] }));
    await romanizeLines({ lines: [{ id: "L1", text: "hi" }], turnstileToken: "tok" });
    const body = JSON.parse(fetchStub.mock.calls[0][1].body as string);
    expect("scheme" in body).toBe(false);
  });

  it("returns the parsed response on 200", async () => {
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "L1",
            lang: "ja",
            scheme: "ja-Latn-hepburn",
            text: "yoru dakedo",
            wordTexts: ["yoru", "dakedo"],
            engine: "cutlet",
            tier: 0,
          },
        ],
        errors: [],
      }),
    );
    const out = await romanizeLines(makePayload());
    expect(out.results).toHaveLength(1);
    expect(out.results[0].text).toBe("yoru dakedo");
    expect(out.results[0].wordTexts).toEqual(["yoru", "dakedo"]);
    expect(out.errors).toEqual([]);
  });

  it("returns partial errors[] on 200 with mixed results", async () => {
    fetchStub.mockResolvedValue(
      jsonResponse({
        results: [{ id: "L1", lang: "ja", scheme: "ja-Latn-hepburn", text: "ok", engine: "cutlet", tier: 0 }],
        errors: [{ id: "L2", reason: "all-chain-tiers-exhausted" }],
      }),
    );
    const out = await romanizeLines(makePayload());
    expect(out.results).toHaveLength(1);
    expect(out.errors).toEqual([{ id: "L2", reason: "all-chain-tiers-exhausted" }]);
  });

  it("throws TurnstileError on 403", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ detail: "turnstile_failed" }, 403));
    await expect(romanizeLines(makePayload())).rejects.toBeInstanceOf(TurnstileError);
  });

  it("throws RateLimitError on 429 with retryAfter parsed from body", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ detail: { error: "rate_limited", retry_after: 17 } }, 429));
    try {
      await romanizeLines(makePayload());
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(17);
    }
  });

  it("falls back to Retry-After header when body lacks retry_after", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ detail: "rate_limited" }, 429, { "Retry-After": "9" }));
    try {
      await romanizeLines(makePayload());
      expect.fail("should throw");
    } catch (err) {
      expect((err as RateLimitError).retryAfter).toBe(9);
    }
  });

  it("defaults retryAfter to 60 when neither body nor header provides one", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ detail: "rate_limited" }, 429));
    try {
      await romanizeLines(makePayload());
      expect.fail("should throw");
    } catch (err) {
      expect((err as RateLimitError).retryAfter).toBe(60);
    }
  });

  it("throws ServiceUnavailableError on 503", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ detail: "all-failed" }, 503));
    await expect(romanizeLines(makePayload())).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("throws ServiceUnavailableError on a network error (fetch rejects)", async () => {
    fetchStub.mockRejectedValue(new TypeError("network down"));
    await expect(romanizeLines(makePayload())).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("throws RomanizationApiError on a 400 malformed-request response", async () => {
    fetchStub.mockResolvedValue(jsonResponse({ detail: "malformed" }, 400));
    try {
      await romanizeLines(makePayload());
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RomanizationApiError);
      expect((err as RomanizationApiError).status).toBe(400);
    }
  });

  it("uses the configured API base from the settings store when set", async () => {
    const { useSettingsStore } = await import("@/stores/settings");
    useSettingsStore.setState({ romanizationApiBase: "https://example.test" });
    fetchStub.mockResolvedValue(jsonResponse({ results: [], errors: [] }));
    await romanizeLines(makePayload());
    expect(fetchStub.mock.calls[0][0]).toBe("https://example.test/v1/romanize");
    useSettingsStore.setState({ romanizationApiBase: "" });
  });

  it("passes abort signal through to fetch", async () => {
    fetchStub.mockImplementation((_url, init) => {
      const sig = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        sig?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    const ctrl = new AbortController();
    const p = romanizeLines({ ...makePayload(), signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
