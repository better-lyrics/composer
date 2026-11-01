import { describe, expect, it } from "vitest";
import {
  buildBridgeAudioFile,
  decodeHeader,
  extensionForBridgeMime,
  normalizeBaseUrl,
} from "@/utils/composer-bridge-api";

// -- normalizeBaseUrl ---------------------------------------------------------

describe("normalizeBaseUrl", () => {
  it("preserves an already-clean URL", () => {
    expect(normalizeBaseUrl("http://localhost:7777")).toBe("http://localhost:7777");
  });

  it("strips a single trailing slash", () => {
    expect(normalizeBaseUrl("http://localhost:7777/")).toBe("http://localhost:7777");
  });

  it("strips repeated trailing slashes", () => {
    expect(normalizeBaseUrl("http://localhost:7777////")).toBe("http://localhost:7777");
  });

  it("leaves an empty string empty", () => {
    expect(normalizeBaseUrl("")).toBe("");
  });

  it("does not touch internal slashes", () => {
    expect(normalizeBaseUrl("http://example.com/path/to/")).toBe("http://example.com/path/to");
  });
});

// -- decodeHeader -------------------------------------------------------------

describe("decodeHeader", () => {
  it("returns undefined for null", () => {
    expect(decodeHeader(null)).toBeUndefined();
  });

  it("returns undefined for empty string (treated as missing header)", () => {
    expect(decodeHeader("")).toBeUndefined();
  });

  it("decodes percent-encoded ASCII", () => {
    expect(decodeHeader("hello%20world")).toBe("hello world");
  });

  it("decodes percent-encoded UTF-8 (the fullwidth comma the bridge had to escape)", () => {
    // 0xEF 0xBC 0x8C is the fullwidth comma. Regression: this was the actual
    // mojibake the user hit ("Tylerï¼Œ..." in the original Latin-1 read).
    expect(decodeHeader("Tyler%EF%BC%8C%20The%20Creator")).toBe("Tyler， The Creator");
  });

  it("returns the raw string when decoding throws (malformed percent sequence)", () => {
    // %ZZ is not valid hex; decodeURIComponent throws URIError. We expect the
    // raw value back so the caller still gets *something* readable.
    expect(decodeHeader("bad%ZZencoding")).toBe("bad%ZZencoding");
  });

  it("returns the raw string for an unencoded value with no percent signs", () => {
    expect(decodeHeader("plain text")).toBe("plain text");
  });
});

// -- extensionForBridgeMime ---------------------------------------------------

describe("extensionForBridgeMime", () => {
  it("maps audio/opus to opus", () => {
    expect(extensionForBridgeMime("audio/opus")).toBe("opus");
  });

  it("maps webm with an opus codec hint to opus (regression for the most common bridge default)", () => {
    expect(extensionForBridgeMime("audio/webm; codecs=opus")).toBe("opus");
  });

  it("maps plain audio/webm to webm", () => {
    expect(extensionForBridgeMime("audio/webm")).toBe("webm");
  });

  it("maps audio/ogg to ogg", () => {
    expect(extensionForBridgeMime("audio/ogg")).toBe("ogg");
  });

  it("maps audio/mp4 to m4a", () => {
    expect(extensionForBridgeMime("audio/mp4")).toBe("m4a");
  });

  it("maps audio/m4a to m4a", () => {
    expect(extensionForBridgeMime("audio/m4a")).toBe("m4a");
  });

  it("maps audio/aac to m4a (AAC bitstream gets the m4a container conventionally)", () => {
    expect(extensionForBridgeMime("audio/aac")).toBe("m4a");
  });

  it("maps audio/mpeg to mp3", () => {
    expect(extensionForBridgeMime("audio/mpeg")).toBe("mp3");
  });

  it("maps audio/mp3 to mp3", () => {
    expect(extensionForBridgeMime("audio/mp3")).toBe("mp3");
  });

  it("falls back to 'audio' for unknown mime", () => {
    expect(extensionForBridgeMime("application/octet-stream")).toBe("audio");
  });

  it("falls back to 'audio' for empty mime", () => {
    expect(extensionForBridgeMime("")).toBe("audio");
  });

  it("matches case-insensitively (regression: server may report uppercase)", () => {
    expect(extensionForBridgeMime("AUDIO/OPUS")).toBe("opus");
    expect(extensionForBridgeMime("Audio/WebM")).toBe("webm");
  });

  it("prefers opus over webm when both substrings are present (regression for the .m4a-mislabel bug)", () => {
    // The bug had us labeling everything .m4a regardless of bytes. Confirm
    // opus wins even when wrapped in a webm container hint.
    expect(extensionForBridgeMime("audio/webm; codecs=opus")).toBe("opus");
  });
});

// -- buildBridgeAudioFile -----------------------------------------------------

describe("buildBridgeAudioFile", () => {
  const buffer = new TextEncoder().encode("hello bridge").buffer;

  it("builds a File named <videoId>.<ext> with the bridge mime as File.type", () => {
    const file = buildBridgeAudioFile(buffer, "audio/opus", "dQw4w9WgXcQ");
    expect(file.name).toBe("dQw4w9WgXcQ.opus");
    expect(file.type).toBe("audio/opus");
  });

  it("preserves the byte payload byte-for-byte", async () => {
    const file = buildBridgeAudioFile(buffer, "audio/opus", "x");
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect(new TextDecoder().decode(bytes)).toBe("hello bridge");
  });

  it("falls back to .audio when mime is unknown", () => {
    const file = buildBridgeAudioFile(buffer, "application/octet-stream", "id");
    expect(file.name).toBe("id.audio");
    expect(file.type).toBe("application/octet-stream");
  });

  it("yields .m4a for audio/mp4 (this is the only case where m4a is correct)", () => {
    const file = buildBridgeAudioFile(buffer, "audio/mp4", "id");
    expect(file.name).toBe("id.m4a");
    expect(file.type).toBe("audio/mp4");
  });

  it("yields .webm not .m4a for plain webm (regression for the file-label bug)", () => {
    const file = buildBridgeAudioFile(buffer, "audio/webm", "id");
    expect(file.name).toBe("id.webm");
    expect(file.type).toBe("audio/webm");
  });

  it("yields .opus for opus, not .m4a (regression for the file-label bug)", () => {
    const file = buildBridgeAudioFile(buffer, "audio/opus", "id");
    expect(file.name).toBe("id.opus");
    expect(file.type).toBe("audio/opus");
  });
});
