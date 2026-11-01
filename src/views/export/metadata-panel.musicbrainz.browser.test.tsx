import { resetMusicBrainzQueue } from "@/lib/musicbrainz-client";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import type { MbRecording } from "@/domain/musicbrainz/types";
import { YOUR_POWER_ALBUM_RECORDING } from "@/test/musicbrainz-recording-fixtures";
import { YOUR_POWER_SEARCH } from "@/test/musicbrainz-search-fixtures";
import { render } from "@/test/render";
import { MetadataPanel } from "@/views/export/metadata-panel";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

// -- Constants ----------------------------------------------------------------

const LOOKUP_TIMEOUT = { timeout: 8000 };

// -- Helpers ------------------------------------------------------------------

// Without release groups no cover art loads, so the test never reaches coverartarchive.org.
function withoutCoverArt(recording: MbRecording): MbRecording {
  return {
    ...recording,
    releases: recording.releases?.map(({ "release-group": _releaseGroup, ...release }) => release),
  };
}

function stubMusicBrainz(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = new URL(url).pathname.startsWith("/ws/2/recording/")
        ? withoutCoverArt(YOUR_POWER_ALBUM_RECORDING)
        : { recordings: YOUR_POWER_SEARCH.recordings.map(withoutCoverArt) };
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
    useSettingsStore.setState({ musicBrainzLookup: "auto" });
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

    await expect.element(screen.getByRole("button", { name: /^Fill/ }), LOOKUP_TIMEOUT).toBeInTheDocument();
    await screen.getByRole("button", { name: /^Fill/ }).click();

    const filled = useProjectStore.getState().metadata;
    expect(filled.album).toBe("Mine");
    expect(filled.isrc).toBe("USUM72105934");
    expect(filled.songwriters).toEqual(["Billie Eilish", "FINNEAS"]);

    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => useProjectStore.getState().metadata.isrc).toBeUndefined();
  });
});
