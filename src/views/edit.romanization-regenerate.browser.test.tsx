import { describe, expect, it } from "vitest";
import { clearGeneratorRegistry, registerGeneratorFactory } from "@/domain/romanization/registry";
import { useProjectStore } from "@/stores/project";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";
import { EditPanel } from "@/views/edit";

// -- Helpers ------------------------------------------------------------------

function seedFilledRomanization(): void {
  useProjectStore.setState({
    lines: [createLine({ id: "L1", text: "夜だけど" })],
  });
  useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
  useProjectStore.getState().setLineRomanization("L1", { text: "old text", source: "manual" });
}

function registerStubGenerator(): void {
  clearGeneratorRegistry();
  registerGeneratorFactory("ja-Latn-hepburn", async () => ({
    scheme: "ja-Latn-hepburn",
    async generateLine(line) {
      return { text: `gen:${line.text}` };
    },
  }));
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel romanization regenerate icon", () => {
  it("renders the regenerate icon when scheme is set and line is non-latin", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await expect
      .element(screen.getByRole("button", { name: "Regenerate romanization", exact: true }))
      .toBeInTheDocument();
  });

  it("does not render the regenerate icon on a latin-only line", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "L1", text: "hello" })] });
    useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Regenerate romanization"]')).toBeNull();
  });

  it("does not render the regenerate icon when scheme is unset", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "L1", text: "夜だけど" })] });
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Regenerate romanization"]')).toBeNull();
  });

  it("regenerates and writes generated romanization on click", async () => {
    seedFilledRomanization();
    registerStubGenerator();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Regenerate romanization", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("gen:夜だけど");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.source).toBe("generated");
    clearGeneratorRegistry();
  });
});
