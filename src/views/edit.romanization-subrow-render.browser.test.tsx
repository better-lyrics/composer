import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

function seedRomanizedLines(): void {
  useProjectStore.setState({
    lines: [
      createLine({ id: "L1", text: "夜だけど" }),
      createLine({ id: "L2", text: "メモリー" }),
      createLine({ id: "L3", text: "hello" }),
    ],
  });
  useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
  useProjectStore.getState().setLineRomanization("L1", { text: "yoru dakedo", source: "generated" });
  useProjectStore.getState().setLineRomanization("L2", { text: "memorii", source: "generated" });
}

function subrowTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-testid="romanization-subrow"]')].map((el) => el.textContent ?? "");
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel romanization subrows", () => {
  it("renders the subrow under each non-latin line that has romanization", async () => {
    seedRomanizedLines();
    const screen = await render(<EditPanel />);
    expect(subrowTexts(screen.container)).toEqual(expect.arrayContaining(["yoru dakedo", "memorii"]));
  });

  it("does not render the subrow when scheme is unset, even if line has romanization data", async () => {
    useProjectStore.setState({
      lines: [createLine({ id: "L1", text: "夜だけど" })],
    });
    useProjectStore.getState().setLineRomanization("L1", { text: "yoru dakedo", source: "generated" });
    const screen = await render(<EditPanel />);
    expect(subrowTexts(screen.container)).toEqual([]);
  });

  it("never renders a subrow under a latin-only line", async () => {
    seedRomanizedLines();
    const screen = await render(<EditPanel />);
    const subrows = subrowTexts(screen.container);
    expect(subrows.find((s) => s === "hello")).toBeUndefined();
  });
});
