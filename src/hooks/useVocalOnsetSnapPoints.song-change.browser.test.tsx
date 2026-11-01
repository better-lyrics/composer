import { detectedGrid } from "@/domain/tempo/beat-grid";
import { useVocalOnsetSnapPoints } from "@/hooks/useVocalOnsetSnapPoints";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

const HookHarness: React.FC = () => {
  useVocalOnsetSnapPoints();
  return null;
};

const grid = detectedGrid({ beats: [1, 2, 3], downbeats: [1] });

function placeMarkersAndGrid(): void {
  useProjectStore.getState().setCustomSnapPoints([2, 4]);
  useProjectStore.getState().setBeatGrid(grid);
}

describe("useVocalOnsetSnapPoints song changes", () => {
  it("regression: clears markers and the beat grid when another song loads", async () => {
    await render(<HookHarness />);
    useAudioStore.setState({ source: { type: "file", file: createAudioFile("song.wav") } });
    placeMarkersAndGrid();

    useAudioStore.setState({ source: { type: "file", file: createAudioFile("another-song.wav") } });

    expect(useProjectStore.getState().customSnapPoints).toEqual([]);
    expect(useProjectStore.getState().beatGrid).toBeNull();
  });

  it("regression: keeps markers and the beat grid when the same song's audio comes back", async () => {
    await render(<HookHarness />);

    useAudioStore.setState({ source: null });
    placeMarkersAndGrid();
    useAudioStore.setState({ source: { type: "file", file: createAudioFile("song.wav") } });
    expect(useProjectStore.getState().beatGrid).toEqual(grid);

    useAudioStore.setState({ source: { type: "youtube", videoId: "video-a" } });
    placeMarkersAndGrid();
    useAudioStore.setState({ source: { type: "youtube", videoId: "video-a", file: createAudioFile("video-a.webm") } });

    expect(useProjectStore.getState().beatGrid).toEqual(grid);
    expect(useProjectStore.getState().customSnapPoints.map((point) => point.time)).toEqual([2, 4]);
  });
});
