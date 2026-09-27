import { describe, expect, it } from "vitest";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";

describe("skippedLinesMessage", () => {
  it("names a single unreadable line", () => {
    expect(skippedLinesMessage(1)).toBe("1 line could not be read.");
  });

  it("pluralizes several unreadable lines", () => {
    expect(skippedLinesMessage(3)).toBe("3 lines could not be read.");
  });
});
