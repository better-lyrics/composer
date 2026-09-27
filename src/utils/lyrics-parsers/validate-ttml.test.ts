import { describe, expect, it } from "vitest";
import { validateTtml } from "@/utils/lyrics-parsers/validate-ttml";

const VALID = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p>Hello</p></div></body></tt>`;

function failureMessage(xml: string): string {
  const result = validateTtml(xml);
  if (result.ok) throw new Error("expected the XML to be invalid");
  return result.message;
}

describe("validateTtml", () => {
  it("accepts well-formed TTML", () => {
    expect(validateTtml(VALID)).toEqual({ ok: true });
  });

  it("rejects a missing closing tag", () => {
    expect(validateTtml(VALID.replace("</tt>", "")).ok).toBe(false);
  });

  it("reports a one-line message for a missing closing tag", () => {
    const message = failureMessage(VALID.replace("</tt>", ""));
    expect(message.trim()).not.toBe("");
    expect(message).not.toContain("\n");
  });

  describe("edge cases", () => {
    it("rejects empty input", () => {
      expect(validateTtml("").ok).toBe(false);
    });

    it("rejects whitespace-only input", () => {
      expect(validateTtml("  \n ").ok).toBe(false);
    });

    it("accepts TTML with an XML declaration", () => {
      expect(validateTtml(`<?xml version="1.0" encoding="UTF-8"?>\n${VALID}`)).toEqual({ ok: true });
    });
  });
});
