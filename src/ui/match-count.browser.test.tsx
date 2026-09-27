import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { MatchCount } from "@/ui/match-count";

describe("MatchCount", () => {
  it("shows the count", async () => {
    const screen = await render(<MatchCount count={4} />);
    expect(screen.container.textContent).toBe("4");
  });

  describe("edge cases", () => {
    it("renders large counts without truncation", async () => {
      const screen = await render(<MatchCount count={128} />);
      expect(screen.container.textContent).toBe("128");
    });
  });
});
