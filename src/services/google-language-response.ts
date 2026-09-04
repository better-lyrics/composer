interface GoogleResponsePart {
  translated: string | null;
  source: string | null;
  romanization: string | null;
}

function invalidResponse(): never {
  throw new Error("Malformed Google Translate response");
}

/** Validate the undocumented array envelope before an empty result can be cached. */
function parseResponse(data: unknown): { parts: GoogleResponsePart[]; detectedLanguage: string } {
  if (!Array.isArray(data) || !Array.isArray(data[0]) || data[0].length === 0) invalidResponse();
  if (data[2] != null && typeof data[2] !== "string") invalidResponse();
  const parts = data[0].map((part: unknown): GoogleResponsePart => {
    if (!Array.isArray(part) || part.length < 2) invalidResponse();
    // Text rows use [translation, source]; dt=rm adds romanization at index 3
    // or, for some responses, index 2. Later columns contain unrelated metadata.
    for (const value of part.slice(0, 4)) {
      if (value != null && typeof value !== "string") invalidResponse();
    }
    if (!part.slice(0, 4).some((value) => typeof value === "string")) invalidResponse();
    return {
      translated: part[0] ?? null,
      source: part[1] ?? null,
      romanization: part[3] ?? part[2] ?? null,
    };
  });
  return { parts, detectedLanguage: data[2] ?? "" };
}

function parseGoogleTranslationResponse(data: unknown): { text: string; detectedLanguage: string } {
  const { parts, detectedLanguage } = parseResponse(data);
  if (parts.some((part) => part.translated === null && part.source === null)) invalidResponse();
  return {
    text: parts
      .map((part) => part.translated ?? "")
      .join("")
      .trim(),
    detectedLanguage,
  };
}

function parseGoogleTransliterationResponse(data: unknown): { text: string; detectedLanguage: string } {
  const { parts, detectedLanguage } = parseResponse(data);
  return { text: parts.map((part) => part.romanization ?? "").join(""), detectedLanguage };
}

export { parseGoogleTranslationResponse, parseGoogleTransliterationResponse };
