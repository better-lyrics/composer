import { cancelCountIn, isCountingIn, requestPlayback, togglePlayback } from "@/lib/sync-count-in";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { useSyncCountInStore } from "@/stores/sync-count-in";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function loadSong(): void {
  useAudioStore.setState({
    source: { type: "file", file: new File(["x"], "song.mp3", { type: "audio/mpeg" }) },
    currentTime: 0,
  });
}

const isPlaying = () => useAudioStore.getState().isPlaying;

beforeEach(() => {
  vi.useFakeTimers();
  loadSong();
  useProjectStore.setState({ activeTab: "sync" });
  useSettingsStore.setState({ syncCountIn: 3 });
});

afterEach(() => {
  cancelCountIn();
  vi.useRealTimers();
});

describe("requestPlayback", () => {
  it("counts in for the configured seconds before playback starts in Sync", () => {
    expect(requestPlayback()).toBe("counting");
    expect(isCountingIn()).toBe(true);
    vi.advanceTimersByTime(2999);
    expect(isPlaying()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(isPlaying()).toBe(true);
    expect(isCountingIn()).toBe(false);
  });

  it("records the count window in the store", () => {
    requestPlayback();
    const { startedAt, endsAt, seconds } = useSyncCountInStore.getState();
    expect(seconds).toBe(3);
    expect(startedAt).not.toBeNull();
    expect((endsAt ?? 0) - (startedAt ?? 0)).toBe(3000);
  });

  it("follows a changed setting", () => {
    useSettingsStore.setState({ syncCountIn: 5 });
    requestPlayback();
    vi.advanceTimersByTime(4999);
    expect(isPlaying()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(isPlaying()).toBe(true);
  });

  describe("edge cases", () => {
    it("plays at once when the count-in is off", () => {
      useSettingsStore.setState({ syncCountIn: 0 });
      expect(requestPlayback()).toBe("playing");
      expect(isPlaying()).toBe(true);
      expect(isCountingIn()).toBe(false);
    });

    it("plays at once when playback resumes past the song start", () => {
      useAudioStore.setState({ currentTime: 12.5 });
      expect(requestPlayback()).toBe("playing");
      expect(isPlaying()).toBe(true);
      expect(isCountingIn()).toBe(false);
    });

    it("plays at once just past the song start", () => {
      useAudioStore.setState({ currentTime: 0.01 });
      expect(requestPlayback()).toBe("playing");
      expect(isCountingIn()).toBe(false);
    });

    it("plays at once outside Sync", () => {
      useProjectStore.setState({ activeTab: "timeline" });
      expect(requestPlayback()).toBe("playing");
      expect(isPlaying()).toBe(true);
    });

    it("plays at once without a song, so no count runs for nothing", () => {
      useAudioStore.setState({ source: null });
      expect(requestPlayback()).toBe("playing");
      expect(isCountingIn()).toBe(false);
    });

    it("does not restart a running count", () => {
      requestPlayback();
      vi.advanceTimersByTime(2000);
      expect(requestPlayback()).toBe("counting");
      vi.advanceTimersByTime(1000);
      expect(isPlaying()).toBe(true);
    });
  });
});

describe("regressions", () => {
  it("regression: plays on without a count when audio is already playing", () => {
    useAudioStore.setState({ isPlaying: true });
    expect(requestPlayback()).toBe("playing");
    expect(isCountingIn()).toBe(false);
    expect(isPlaying()).toBe(true);
  });

  it("regression: a song change during the count cancels it so the new song never starts by itself", () => {
    requestPlayback();
    loadSong();
    expect(isCountingIn()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(isPlaying()).toBe(false);
  });

  it("regression: unloading the song during the count cancels it", () => {
    requestPlayback();
    useAudioStore.setState({ source: null });
    expect(isCountingIn()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(isPlaying()).toBe(false);
  });

  it("keeps counting through unrelated audio changes", () => {
    requestPlayback();
    useAudioStore.setState({ currentTime: 12, volume: 0.5 });
    expect(isCountingIn()).toBe(true);
  });
});

describe("cancelCountIn", () => {
  it("stops a running count so playback never starts", () => {
    requestPlayback();
    vi.advanceTimersByTime(1000);
    cancelCountIn();
    vi.advanceTimersByTime(5000);
    expect(isPlaying()).toBe(false);
    expect(useSyncCountInStore.getState()).toMatchObject({ startedAt: null, endsAt: null });
  });

  it("is safe without a running count", () => {
    expect(() => cancelCountIn()).not.toThrow();
    expect(isCountingIn()).toBe(false);
  });
});

describe("togglePlayback", () => {
  it("cancels a running count", () => {
    requestPlayback();
    togglePlayback();
    vi.advanceTimersByTime(5000);
    expect(isPlaying()).toBe(false);
    expect(isCountingIn()).toBe(false);
  });

  it("pauses while playing", () => {
    useAudioStore.setState({ isPlaying: true });
    togglePlayback();
    expect(isPlaying()).toBe(false);
    expect(isCountingIn()).toBe(false);
  });

  it("starts a count while paused in Sync", () => {
    togglePlayback();
    expect(isCountingIn()).toBe(true);
    expect(isPlaying()).toBe(false);
  });
});

describe("invariants", () => {
  it("clears the store after the count finishes", () => {
    requestPlayback();
    vi.advanceTimersByTime(3000);
    expect(useSyncCountInStore.getState()).toMatchObject({ startedAt: null, endsAt: null });
  });
});
