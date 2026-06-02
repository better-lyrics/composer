const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

class RateLimitError extends Error {
  constructor() {
    super("Google romanization rate limit (302 /sorry/index)");
    this.name = "RateLimitError";
  }
}

class ParseError extends Error {
  constructor(message: string) {
    super(`Google romanization parse error: ${message}`);
    this.name = "ParseError";
  }
}

interface FetchArgs {
  sourceLang: string;
  text: string;
  signal?: AbortSignal;
}

interface FetchResult {
  romaji: string;
}

async function fetchGoogleRomanization(args: FetchArgs): Promise<FetchResult> {
  const url = `${ENDPOINT}?client=gtx&sl=${encodeURIComponent(args.sourceLang)}&tl=en&dt=rm`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(args.text)}`,
    cache: "force-cache",
    redirect: "manual",
    signal: args.signal,
  });

  if (res.status === 302) throw new RateLimitError();
  if (!res.ok) throw new Error(`Google romanization HTTP ${res.status}`);

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new ParseError("non-JSON response");
  }

  const romaji = extractRomajiField(parsed);
  if (romaji === undefined) throw new ParseError("missing data[0][i][3] field");
  return { romaji };
}

function extractRomajiField(json: unknown): string | undefined {
  if (!Array.isArray(json)) return undefined;
  const data0 = json[0];
  if (!Array.isArray(data0) || data0.length === 0) return undefined;
  let out = "";
  let any = false;
  for (const segment of data0) {
    if (Array.isArray(segment) && typeof segment[3] === "string") {
      out += segment[3];
      any = true;
    }
  }
  return any ? out : undefined;
}

export { fetchGoogleRomanization, ParseError, RateLimitError };
export type { FetchArgs, FetchResult };
