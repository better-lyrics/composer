import { describe, expect, it } from "vitest";
import { SyncCarousel } from "@/views/sync/sync-carousel";
import { render } from "@/test/render";

const LINES = [
  { id: "l1", text: "First line", begin: 0 },
  { id: "l2", text: "Second line", begin: 1 },
  { id: "l3", text: "Third line", begin: 2 },
];

describe("SyncCarousel", () => {
  it("renders the current line and adjacent lines", async () => {
    const screen = await render(
      <SyncCarousel lines={LINES} lineIndex={1} wordIndex={0} granularity="line" />,
    );
    expect(screen.container.textContent).toContain("Second");
  });

  it("renders nothing extra for an empty lines array", async () => {
    const screen = await render(<SyncCarousel lines={[]} lineIndex={0} wordIndex={0} granularity="line" />);
    expect(screen.container.textContent ?? "").toBe("");
  });

  it("switches to word granularity rendering when granularity='word'", async () => {
    const screen = await render(
      <SyncCarousel
        lines={[{ id: "l1", text: "alpha beta gamma", begin: 0, words: [] }]}
        lineIndex={0}
        wordIndex={1}
        granularity="word"
      />,
    );
    expect(screen.container.textContent).toContain("alpha");
  });
});
