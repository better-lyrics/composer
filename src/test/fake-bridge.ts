import { vi } from "vitest";

// -- Types --------------------------------------------------------------------

interface ServedAudio {
  bytes: ArrayBuffer;
  mimeType: string;
}

interface FakeBridge {
  audioCalls: string[];
  serveAudio: (videoId: string, bytes: ArrayBuffer, mimeType?: string) => void;
  goOffline: () => void;
  goOnline: () => void;
}

// -- Helpers ------------------------------------------------------------------

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
}

// -- Fake ---------------------------------------------------------------------

function installFakeBridge(): FakeBridge {
  const served = new Map<string, ServedAudio>();
  let offline = false;
  const bridge: FakeBridge = {
    audioCalls: [],
    serveAudio: (videoId, bytes, mimeType = "audio/opus") => {
      served.set(videoId, { bytes, mimeType });
    },
    goOffline: () => {
      offline = true;
    },
    goOnline: () => {
      offline = false;
    },
  };
  vi.stubGlobal("fetch", async (input: RequestInfo | URL): Promise<Response> => {
    const url = requestUrl(input);
    if (offline) throw new TypeError("Failed to fetch");
    if (/\/health$/.test(url)) return Response.json({ bridge: "0.1.0", ytdlp: "2025.06.30", status: "ok" });
    const audioMatch = url.match(/\/audio\/([A-Za-z0-9_-]+)$/);
    if (!audioMatch) return new Response(null, { status: 404 });
    const videoId = audioMatch[1] ?? "";
    bridge.audioCalls.push(videoId);
    const audio = served.get(videoId);
    if (!audio) return new Response(null, { status: 502 });
    return new Response(audio.bytes.slice(0), { headers: { "content-type": audio.mimeType } });
  });
  return bridge;
}

// -- Exports ------------------------------------------------------------------

export { installFakeBridge };
export type { FakeBridge };
