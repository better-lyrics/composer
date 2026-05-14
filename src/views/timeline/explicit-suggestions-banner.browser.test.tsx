import { describe, expect, it } from "vitest";
import { ExplicitSuggestionsBanner } from "@/views/timeline/explicit-suggestions-banner";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";

describe("ExplicitSuggestionsBanner", () => {
  it("renders nothing when there are no explicit-word suggestions", async () => {
    useProjectStore.setState({ lines: [createLine({ text: "innocuous line" })] });
    const screen = await render(<ExplicitSuggestionsBanner />);
    expect(screen.container.textContent ?? "").toBe("");
  });
});
