import { vi } from "vitest";

// -- Helpers ------------------------------------------------------------------

function stubJapaneseGoogleLanguageFetch(): void {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const romanization = url.searchParams.getAll("dt").includes("rm");
    const data = romanization
      ? [
          [
            ["こんにちは", "こんにちは", null, null],
            [null, null, "kon-nichiwa", "kon-nichiwa"],
          ],
          null,
          "ja",
        ]
      : [[["Hello", "こんにちは"]], null, "ja"];
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  });
}

// -- Exports ------------------------------------------------------------------

export { stubJapaneseGoogleLanguageFetch };
