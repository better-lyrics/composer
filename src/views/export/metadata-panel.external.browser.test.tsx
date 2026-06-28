import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { MetadataPanel } from "@/views/export/metadata-panel";

// Regression: metadata written externally after the panel mounts (project load,
// hash/query import, lyrics import) must be reflected in the editing fields, and
// editing must never drop entries it never saw. See the parent/child lifecycle
// bug fixed by routing every field list through useReconciledBuffer.

const open = (screen: Awaited<ReturnType<typeof render>>) => screen.getByRole("button", { name: "Metadata" }).click();

describe("MetadataPanel external writes after mount", () => {
  it("shows extra fields written externally before the panel is first opened", async () => {
    const screen = await render(<MetadataPanel />);

    useProjectStore.getState().setMetadata({ extra: { spotifyId: "abc" } });

    await open(screen);
    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("spotifyId");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 value" })).toHaveValue("abc");
  });

  it("shows artists written externally before the panel is first opened", async () => {
    const screen = await render(<MetadataPanel />);

    useProjectStore.getState().setMetadata({ artists: ["Alpha"] });

    await open(screen);
    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Alpha");
  });

  it("updates the artist field when artists are written externally while open", async () => {
    const screen = await render(<MetadataPanel />);
    await open(screen);
    await expect.element(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();

    useProjectStore.getState().setMetadata({ artists: ["Alpha"] });

    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Alpha");
  });

  it("updates the extra fields when extra is written externally while open", async () => {
    const screen = await render(<MetadataPanel />);
    await open(screen);
    await expect.element(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();

    useProjectStore.getState().setMetadata({ extra: { isrcSource: "manual" } });

    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("isrcSource");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 value" })).toHaveValue("manual");
  });

  it("keeps externally-imported extras when the user adds another field", async () => {
    const screen = await render(<MetadataPanel />);

    useProjectStore.getState().setMetadata({ extra: { imported: "x" } });

    await open(screen);
    await screen.getByRole("button", { name: "Add field" }).click();
    await screen.getByRole("textbox", { name: "Field 2 key" }).fill("newKey");
    await screen.getByRole("textbox", { name: "Field 2 value" }).fill("newVal");

    await expect.poll(() => useProjectStore.getState().metadata.extra).toEqual({ imported: "x", newKey: "newVal" });
  });

  it("reflects an external artists write after close and reopen", async () => {
    const screen = await render(<MetadataPanel />);
    const toggle = screen.getByRole("button", { name: "Metadata" });

    await toggle.click();
    await expect.element(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    useProjectStore.getState().setMetadata({ artists: ["Alpha"] });

    await toggle.click();
    await expect.poll(() => screen.container.querySelector("[aria-label='Title']")).toBeNull();
    await toggle.click();

    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Alpha");
  });

  it("updates the ISRC field when isrc is written externally while open", async () => {
    const screen = await render(<MetadataPanel />);
    await open(screen);
    await expect.element(screen.getByRole("textbox", { name: "ISRC" })).toBeInTheDocument();

    useProjectStore.getState().setMetadata({ isrc: "GBARL9300135" });

    await expect.element(screen.getByRole("textbox", { name: "ISRC" })).toHaveValue("GBARL9300135");
  });
});
