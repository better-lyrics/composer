import { describe, expect, it } from "vitest";
import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { render } from "@/test/render";
import { SyncSection } from "@/ui/help-sections/syncing";

describe("SyncSection", () => {
  it("renders the section content", async () => {
    const screen = await render(<SyncSection />);
    await expect.element(screen.getByRole("heading", { name: "Tap (Space)" })).toBeInTheDocument();
  });

  it("renders inline shortcut key badges", async () => {
    const screen = await render(<SyncSection />);
    await expect.poll(() => screen.container.querySelectorAll("[data-inline-key-badge]").length).toBeGreaterThan(0);
  });

  it("documents the per-word syllable splitter", async () => {
    const screen = await render(<SyncSection />);
    await expect.element(screen.getByRole("heading", { name: "Splitting syllables" })).toBeInTheDocument();
  });

  it("names the user's undo binding", async () => {
    useShortcutBindingsStore.setState({ overrides: { "global.undo": { key: "b", mod: true } } });
    const screen = await render(<SyncSection />);

    await expect
      .poll(() => [...screen.container.querySelectorAll("[data-inline-key-badge]")].map((badge) => badge.textContent))
      .toContainEqual(expect.stringMatching(/B$/));
  });

  it("documents the count-in, its setting and how to skip it", async () => {
    const screen = await render(<SyncSection />);
    await expect.element(screen.getByRole("heading", { name: "Counting in" })).toBeInTheDocument();
    expect(screen.container.textContent).toContain("Count-in");
    expect(screen.container.textContent).toContain("Set it to 0 to turn it off");
    expect(screen.container.textContent).toContain("Press Escape to skip");
  });
});
