import { seekBy, useAudioStore } from "@/stores/audio";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useAudioStore.getState().reset();
});

describe("seekBy", () => {
  it("moves the playhead from the live time by the step", () => {
    useAudioStore.setState({ duration: 60, currentTime: 10 });
    seekBy(5);
    expect(useAudioStore.getState().currentTime).toBe(15);
    seekBy(-3);
    expect(useAudioStore.getState().currentTime).toBe(12);
  });

  describe("edge cases", () => {
    it("stops at the start and the end of the song", () => {
      useAudioStore.setState({ duration: 60, currentTime: 2 });
      seekBy(-5);
      expect(useAudioStore.getState().currentTime).toBe(0);
      useAudioStore.setState({ currentTime: 58 });
      seekBy(5);
      expect(useAudioStore.getState().currentTime).toBe(60);
    });

    it("has no end while the duration is unknown", () => {
      useAudioStore.setState({ duration: 0, currentTime: 2 });
      seekBy(5);
      expect(useAudioStore.getState().currentTime).toBe(7);
    });
  });
});
