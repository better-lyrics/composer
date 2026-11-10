import { describe, expect, it } from "vitest";
import { withoutComments } from "@/test/source-scan";

describe("withoutComments", () => {
  it("regression: keeps code after a string that holds a spaced double slash", () => {
    const code = `const label = "a //b"; requestAnimationFrame(step); // trailing note`;

    const scanned = withoutComments(code);

    expect(scanned).toContain("requestAnimationFrame(step);");
    expect(scanned).not.toContain("trailing note");
  });
});
