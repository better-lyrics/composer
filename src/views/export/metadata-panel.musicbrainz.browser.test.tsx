import { resetMusicBrainzQueue } from "@/lib/musicbrainz-client";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { YOUR_POWER_ALBUM_RECORDING } from "@/test/musicbrainz-recording-fixtures";
import { YOUR_POWER_SEARCH } from "@/test/musicbrainz-search-fixtures";
import { render } from "@/test/render";
import { MetadataPanel } from "@/views/export/metadata-panel";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const LOOKUP_TIMEOUT = { timeout: 8000 };

// -- Helpers ------------------------------------------------------------------

function stubMusicBrainz(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = new URL(url).pathname.startsWith("/ws/2/recording/")
        ? YOUR_POWER_ALBUM_RECORDING
        : YOUR_POWER_SEARCH;
      return Response.json(body);
    }),
  );
}

// -- Tests --------------------------------------------------------------------

describe("MetadataPanel MusicBrainz suggestions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetMusicBrainzQueue();
  });

  it("fills the empty fields from MusicBrainz and Undo restores them", async () => {
    stubMusicBrainz();
    useAudioStore.setState({ duration: 246 });
    useProjectStore.setState({
      metadata: { title: "Your Power", artists: ["Billie Eilish"], album: "Mine", duration: 0 },
    });
    const screen = await render(
      <>
        <MetadataPanel />
        <Toaster />
      </>,
    );

    await expect.element(screen.getByRole("button", { name: "Review" }), LOOKUP_TIMEOUT).toBeInTheDocument();
    await screen.getByRole("button", { name: "Review" }).click();
    await screen.getByRole("button", { name: /^Fill/ }).click();

    const filled = useProjectStore.getState().metadata;
    expect(filled.album).toBe("Mine");
    expect(filled.isrc).toBe("USUM72105934");
    expect(filled.songwriters).toEqual(["Billie Eilish", "FINNEAS"]);

    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => useProjectStore.getState().metadata.isrc).toBeUndefined();
  });
});
