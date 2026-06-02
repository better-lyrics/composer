import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGoogleRomanization, ParseError, RateLimitError } from "@/utils/romanization/google/fetch";

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function makeFetchSpy(response: () => Response) {
  return vi.fn<FetchMock>(async () => response());
}

beforeEach(() => vi.restoreAllMocks());

describe("fetchGoogleRomanization: request shape", () => {
  it("POSTs to translate.googleapis.com/translate_a/single with the expected query params", async () => {
    const fetchSpy = makeFetchSpy(
      () => new Response(JSON.stringify([[[null, null, null, "annyeong"]]]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    const urlStr = String(url);
    expect(urlStr).toContain("translate.googleapis.com/translate_a/single");
    expect(urlStr).toContain("client=gtx");
    expect(urlStr).toContain("sl=ko");
    expect(urlStr).toContain("tl=en");
    expect(urlStr).toContain("dt=rm");
    expect(init?.method).toBe("POST");
  });

  it("sends Content-Type application/x-www-form-urlencoded with q= form body", async () => {
    const fetchSpy = makeFetchSpy(
      () => new Response(JSON.stringify([[[null, null, null, "annyeong"]]]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(typeof init?.body).toBe("string");
    expect(String(init?.body)).toMatch(/^q=/);
    expect(String(init?.body)).toBe(`q=${encodeURIComponent("안녕")}`);
  });

  it("url-encodes the source lang correctly when it contains hyphens (none of our 8 do, but be defensive)", async () => {
    const fetchSpy = makeFetchSpy(
      () => new Response(JSON.stringify([[[null, null, null, "shalom"]]]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchGoogleRomanization({ sourceLang: "he-IL", text: "שלום" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("sl=he-IL");
  });

  it("forwards an AbortSignal to fetch when provided", async () => {
    const fetchSpy = makeFetchSpy(
      () => new Response(JSON.stringify([[[null, null, null, "annyeong"]]]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const controller = new AbortController();
    await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕", signal: controller.signal });
    expect(fetchSpy.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("opts into redirect: 'manual' so 302s do not auto-follow", async () => {
    const fetchSpy = makeFetchSpy(
      () => new Response(JSON.stringify([[[null, null, null, "annyeong"]]]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" });
    expect(fetchSpy.mock.calls[0][1]?.redirect).toBe("manual");
  });
});

describe("fetchGoogleRomanization: response parsing", () => {
  it("extracts data[0][i][3] strings and concatenates them as the romaji result", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(
        () =>
          new Response(
            JSON.stringify([
              [
                ["nope", null, null, "annyeong "],
                ["nope", null, null, "haseyo"],
              ],
            ]),
            { status: 200 },
          ),
      ),
    );
    const result = await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕하세요" });
    expect(result.romaji).toBe("annyeong haseyo");
  });

  it("skips non-string slots when extracting (defensive against Google's null insertions)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(
        () =>
          new Response(
            JSON.stringify([
              [
                ["nope", null, null, "annyeong "],
                ["nope", null, null, null],
                ["nope", null, null, "haseyo"],
              ],
            ]),
            { status: 200 },
          ),
      ),
    );
    const result = await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕하세요" });
    expect(result.romaji).toBe("annyeong haseyo");
  });

  it("preserves embedded delimiter characters in the romaji output (does not strip ␞ or ␝)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response(JSON.stringify([[[null, null, null, "annyeong␞haseyo"]]]), { status: 200 })),
    );
    const result = await fetchGoogleRomanization({ sourceLang: "ko", text: "안녕␞하세요" });
    expect(result.romaji).toBe("annyeong␞haseyo");
  });
});

describe("fetchGoogleRomanization: failure modes", () => {
  it("throws RateLimitError when the response is 302", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response(null, { status: 302 })),
    );
    await expect(fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws RateLimitError with a clear message", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response(null, { status: 302 })),
    );
    await expect(fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" })).rejects.toThrow(/rate.?limit/i);
  });

  it("throws generic Error with status code on non-2xx, non-302 responses", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response("server error", { status: 500 })),
    );
    await expect(fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" })).rejects.toThrow(/500/);
  });

  it("throws ParseError when the response body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response("<html>not json</html>", { status: 200 })),
    );
    await expect(fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" })).rejects.toBeInstanceOf(ParseError);
  });

  it("throws ParseError when the response JSON shape is unexpected (no data[0])", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response(JSON.stringify({ unexpected: true }), { status: 200 })),
    );
    await expect(fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" })).rejects.toBeInstanceOf(ParseError);
  });

  it("throws ParseError when data[0] is empty and no romaji can be extracted", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchSpy(() => new Response(JSON.stringify([[]]), { status: 200 })),
    );
    await expect(fetchGoogleRomanization({ sourceLang: "ko", text: "안녕" })).rejects.toBeInstanceOf(ParseError);
  });

  it("propagates AbortError when the signal aborts mid-fetch", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchMock>(async (_input, init) => {
        if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        throw new DOMException("Aborted", "AbortError");
      }),
    );
    controller.abort();
    await expect(
      fetchGoogleRomanization({ sourceLang: "ko", text: "안녕", signal: controller.signal }),
    ).rejects.toThrow();
  });
});
