import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { clearGeneratorRegistry, registerGeneratorFactory } from "@/domain/romanization/registry";
import { markPersistenceSettled } from "@/lib/persistence-settled";
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
  useProjectStore.getState().setLineRomanization("L1", { text: "yoru dakedo", source: "generated" });
}

function seedGhostState(): void {
  useProjectStore.setState({
    lines: [createLine({ id: "L1", text: "夜だけど" })],
  });
  useProjectStore.getState().setRomanizationScheme("ja-Latn-hepburn");
}

function registerStubGenerator(): void {
  clearGeneratorRegistry();
  registerGeneratorFactory("ja-Latn-hepburn", async () => ({
    scheme: "ja-Latn-hepburn",
    async generateLine(line) {
      return { text: `auto:${line.text}` };
    },
  }));
}

// -- Tests --------------------------------------------------------------------

describe("EditPanel romanization edit popover", () => {
  beforeEach(() => {
    markPersistenceSettled();
  });

  it("opens an input when the romanization subrow is clicked", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    await expect.element(screen.getByRole("textbox", { name: /romanization text/i })).toBeInTheDocument();
  });

  it("opens the popover from the ghost +Add subrow", async () => {
    seedGhostState();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "+ Add romanization", exact: true }).click();
    await expect.element(screen.getByRole("textbox", { name: /romanization text/i })).toBeInTheDocument();
  });

  it("saves manual edits when Enter is pressed", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    const input = screen.getByRole("textbox", { name: /romanization text/i });
    await input.fill("yo-ru dake-do");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yo-ru dake-do");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.source).toBe("manual");
  });

  it("clears romanization via the Clear button", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    await screen.getByRole("button", { name: "Clear romanization", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization).toBeUndefined();
  });

  it("regenerates romanization via the Regenerate button", async () => {
    seedFilledRomanization();
    registerStubGenerator();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    await screen.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("auto:夜だけど");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.source).toBe("generated");
    clearGeneratorRegistry();
  });

  it("closes without saving when Escape is pressed", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    const input = screen.getByRole("textbox", { name: /romanization text/i });
    await input.fill("temp value");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
  });
});

describe("EditPanel romanization edit popover invariants", () => {
  beforeEach(() => {
    markPersistenceSettled();
  });

  it("focuses the input on open", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    const input = screen.getByRole("textbox", { name: /romanization text/i }).element();
    await expect.poll(() => document.activeElement).toBe(input);
  });

  it("does not show the popover trigger when scheme is unset", async () => {
    useProjectStore.setState({ lines: [createLine({ id: "L1", text: "夜だけど" })] });
    const screen = await render(<EditPanel />);
    expect(screen.container.querySelector('[aria-label="Edit romanization"]')).toBeNull();
  });

  it("preserves source: generated when the popover is opened and closed without editing", async () => {
    seedFilledRomanization();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    const input = screen.getByRole("textbox", { name: /romanization text/i }).element() as HTMLInputElement;
    input.blur();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.source).toBe("generated");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("yoru dakedo");
  });

  it("preserves source: generated after Regenerate when the popover closes", async () => {
    seedFilledRomanization();
    registerStubGenerator();
    const screen = await render(<EditPanel />);
    await screen.getByRole("button", { name: "Edit romanization", exact: true }).click();
    await screen.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.source).toBe("generated");
    await expect.poll(() => useProjectStore.getState().lines[0].romanization?.text).toBe("auto:夜だけど");
    clearGeneratorRegistry();
  });
});
