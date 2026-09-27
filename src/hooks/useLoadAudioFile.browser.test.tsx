import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useLoadAudioFile } from "@/hooks/useLoadAudioFile";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";

// -- Helpers -------------------------------------------------------------------

function textNamedMp3(): File {
  return new File(["[00:01.00]these are lyrics, not audio"], "song.mp3", { type: "audio/mpeg" });
}

async function loader() {
  const { result } = await renderHook(() => useLoadAudioFile());
  return result.current;
}

// -- Tests ---------------------------------------------------------------------

describe("useLoadAudioFile", () => {
  it("leaves the song and its details untouched when the file is not playable", async () => {
    const current = createAudioFile("Current.wav");
    useAudioStore.getState().setSource({ type: "file", file: current });
    useProjectStore.getState().setMetadata({ title: "Current", isrc: "USRC17607839" });
    const metadataBefore = useProjectStore.getState().metadata;
    const screen = await render(<Toaster />);

    const load = await loader();
    await load(textNamedMp3());

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(current);
    expect(useProjectStore.getState().metadata).toBe(metadataBefore);
    await expect.element(screen.getByText("That file is not playable audio.")).toBeInTheDocument();
  });

  it("loads a playable file", async () => {
    const file = createAudioFile("Lovefield.wav");

    const load = await loader();
    await load(file);

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(file);
    expect(useProjectStore.getState().metadata.title).toBe("Lovefield");
  });

  it("lets only the latest pick apply when an unplayable file is still being checked", async () => {
    const valid = createAudioFile("Valid.wav");

    const load = await loader();
    const first = load(textNamedMp3());
    const second = load(valid);
    await Promise.all([first, second]);

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(valid);
    expect(useProjectStore.getState().metadata.title).toBe("Valid");
  });

  it("drops a playable pick that a newer pick overtook", async () => {
    const older = createAudioFile("Older.wav");
    const newer = createAudioFile("Newer.wav");

    const load = await loader();
    const first = load(older);
    const second = load(newer);
    await Promise.all([first, second]);

    const source = useAudioStore.getState().source;
    expect(source?.type === "file" && source.file).toBe(newer);
    expect(useProjectStore.getState().metadata.title).toBe("Newer");
  });
});
