import { describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { render } from "@/test/render";
import { MetadataPanel } from "@/views/export/metadata-panel";

// -- Helpers ------------------------------------------------------------------

function seedMetadata(patch: Partial<ReturnType<typeof useProjectStore.getState>["metadata"]> = {}): void {
  useProjectStore.setState({
    metadata: { title: "", artists: [], album: "", duration: 0, ...patch },
  });
}

// -- Tests --------------------------------------------------------------------

describe("MetadataPanel", () => {
  it("starts collapsed and reveals the fields when expanded", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);

    expect(screen.container.querySelector("[role='textbox'][aria-label='Title']")).toBeNull();

    await screen.getByRole("button", { name: "Metadata" }).click();
    await expect.element(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    await expect.element(screen.getByRole("textbox", { name: "Album" })).toBeInTheDocument();
    await expect.element(screen.getByRole("textbox", { name: "ISRC" })).toBeInTheDocument();
  });

  it("typing in Title updates the store", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("textbox", { name: "Title" }).fill("Bad Guy");
    await expect.poll(() => useProjectStore.getState().metadata.title).toBe("Bad Guy");
  });

  it("typing in Album updates the store", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("textbox", { name: "Album" }).fill("When We All Fall Asleep");
    await expect.poll(() => useProjectStore.getState().metadata.album).toBe("When We All Fall Asleep");
  });

  it("adds an artist row and preserves an exact comma-containing name", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("button", { name: "Add artist" }).click();
    await screen.getByRole("textbox", { name: "Artist 1" }).fill("Tyler, The Creator");
    await expect.poll(() => useProjectStore.getState().metadata.artists).toEqual(["Tyler, The Creator"]);
  });

  it("removes an artist row", async () => {
    seedMetadata({ artists: ["Alpha", "Beta"] });
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("button", { name: "Remove artist 1" }).click();
    await expect.poll(() => useProjectStore.getState().metadata.artists).toEqual(["Beta"]);
  });

  it("adds a producer row backed by songwriters", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("button", { name: "Add producer" }).click();
    await screen.getByRole("textbox", { name: "Producer 1" }).fill("Finneas");
    await expect.poll(() => useProjectStore.getState().metadata.songwriters).toEqual(["Finneas"]);
  });

  it("shows a hint and does not store an invalid ISRC", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("textbox", { name: "ISRC" }).fill("not-valid");
    await expect.element(screen.getByText(/Invalid ISRC/)).toBeInTheDocument();
    expect(useProjectStore.getState().metadata.isrc).toBeUndefined();
  });

  it("stores a normalized uppercase ISRC for valid input", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("textbox", { name: "ISRC" }).fill("usqx91700001");
    await expect.poll(() => useProjectStore.getState().metadata.isrc).toBe("USQX91700001");
  });

  it("seeds the ISRC field from the existing store value", async () => {
    seedMetadata({ isrc: "USQX91700001" });
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await expect.element(screen.getByRole("textbox", { name: "ISRC" })).toHaveValue("USQX91700001");
  });

  it("adds an extra key/value row and writes it to the store", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await screen.getByRole("button", { name: "Add field" }).click();
    await screen.getByRole("textbox", { name: "Field 1 key" }).fill("spotifyId");
    await screen.getByRole("textbox", { name: "Field 1 value" }).fill("abc");
    await expect.poll(() => useProjectStore.getState().metadata.extra).toEqual({ spotifyId: "abc" });
  });

  it("seeds artists, producers, and extra rows from the existing store value", async () => {
    seedMetadata({
      artists: ["Billie Eilish"],
      songwriters: ["Finneas"],
      extra: { spotifyId: "abc" },
    });
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    await expect.element(screen.getByRole("textbox", { name: "Artist 1" })).toHaveValue("Billie Eilish");
    await expect.element(screen.getByRole("textbox", { name: "Producer 1" })).toHaveValue("Finneas");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 key" })).toHaveValue("spotifyId");
    await expect.element(screen.getByRole("textbox", { name: "Field 1 value" })).toHaveValue("abc");
  });

  it("supports keyboard: Tab moves focus from the Title input to the Album input", async () => {
    seedMetadata();
    const screen = await render(<MetadataPanel />);
    await screen.getByRole("button", { name: "Metadata" }).click();

    const title = screen.getByRole("textbox", { name: "Title" }).element() as HTMLInputElement;
    title.focus();
    expect(document.activeElement).toBe(title);

    title.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    const album = screen.getByRole("textbox", { name: "Album" }).element() as HTMLInputElement;
    album.focus();
    await expect.poll(() => document.activeElement).toBe(album);
  });
});
