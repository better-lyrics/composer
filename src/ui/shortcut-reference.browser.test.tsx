import { describe, expect, it } from "vitest";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { render } from "@/test/render";
import { KeyBadge, SHORTCUT_SECTIONS, ShortcutSection } from "@/ui/shortcut-reference";

describe("KeyBadge", () => {
  it("renders a formatted key symbol", async () => {
    const screen = await render(<KeyBadge keyName="Shift" />);
    await expect.element(screen.getByText("⇧")).toBeInTheDocument();
  });
});

describe("ShortcutSection", () => {
  it("renders the title and each shortcut description", async () => {
    const screen = await render(
      <ShortcutSection title="Test Section" shortcuts={[{ keys: ["A"], description: "do a thing" }]} />,
    );
    await expect.element(screen.getByRole("heading", { name: "Test Section" })).toBeInTheDocument();
    await expect.element(screen.getByText("do a thing")).toBeInTheDocument();
  });
});

describe("SHORTCUT_SECTIONS", () => {
  it.each(["Sync Mode", "Timeline Mode"])("shows the user's undo and redo bindings in %s", async (title) => {
    useShortcutBindingsStore.setState({
      overrides: { "global.undo": { key: "b", mod: true }, "global.redo": { key: "r", mod: true, alt: true } },
    });
    const section = SHORTCUT_SECTIONS.find((candidate) => candidate.title === title);
    if (!section) throw new Error(`missing section ${title}`);
    const screen = await render(<ShortcutSection {...section} />);

    expect(screen.getByText("Undo", { exact: true }).element().parentElement?.textContent).toMatch(/B$/);
    expect(screen.getByText("Redo", { exact: true }).element().parentElement?.textContent).toMatch(/R$/);
  });
});
