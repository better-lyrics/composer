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

interface GoogleLanguageTable {
  detectedLanguage: string;
  romanizations: Record<string, string>;
  translations: Record<string, string>;
}

interface GoogleLanguageRequest {
  kind: "romanization" | "translation";
  text: string;
}

// Unknown text answers 500, so a test can make a single line fail.
function stubGoogleLanguageFetch(table: GoogleLanguageTable, answerAfter?: Promise<void>): GoogleLanguageRequest[] {
  const requests: GoogleLanguageRequest[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const text = url.searchParams.get("q") ?? "";
    const kind = url.searchParams.getAll("dt").includes("rm") ? "romanization" : "translation";
    requests.push({ kind, text });
    await answerAfter;
    init?.signal?.throwIfAborted();
    const answer = kind === "romanization" ? table.romanizations[text] : table.translations[text];
    if (answer === undefined) return new Response("", { status: 500 });
    const data =
      kind === "romanization"
        ? [
            [
              [text, text, null, null],
              [null, null, answer, answer],
            ],
            null,
            table.detectedLanguage,
          ]
        : [[[answer, text]], null, table.detectedLanguage];
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  });
  return requests;
}

// -- Exports ------------------------------------------------------------------

export { stubGoogleLanguageFetch, stubJapaneseGoogleLanguageFetch };
export type { GoogleLanguageRequest };
