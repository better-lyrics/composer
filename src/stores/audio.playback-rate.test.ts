import { toggledPlaybackRate, useAudioStore } from "@/stores/audio";
import { DEFAULTS, useSettingsStore } from "@/stores/settings";
import { migrateSettings } from "@/stores/settings-migration";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULTS });
  useAudioStore.getState().reset();
});

function startSession(): void {
  useAudioStore.getState().reset();
}

describe("playback speed between sessions", () => {
  it("remembers the last speed while Remember playback speed is on", () => {
    useAudioStore.getState().setPlaybackRate(1.25);
    expect(useSettingsStore.getState().lastPlaybackRate).toBe(1.25);
    startSession();
    expect(useAudioStore.getState().playbackRate).toBe(1.25);
  });

  it("starts at the default playback rate while Remember playback speed is off", () => {
    useSettingsStore.setState({ rememberPlaybackRate: false, defaultPlaybackRate: 0.5 });
    useAudioStore.getState().setPlaybackRate(1.25);
    startSession();
    expect(useAudioStore.getState().playbackRate).toBe(0.5);
  });

  it("starts at the default playback rate on a fresh profile", () => {
    startSession();
    expect(useAudioStore.getState().playbackRate).toBe(DEFAULTS.defaultPlaybackRate);
  });
});

describe("regressions", () => {
  it("regression: changing the speed never rewrites the default playback rate", () => {
    useSettingsStore.setState({ defaultPlaybackRate: 0.6 });
    useAudioStore.getState().setPlaybackRate(1.5);
    useAudioStore.getState().setPlaybackRate(1);
    expect(useSettingsStore.getState().defaultPlaybackRate).toBe(0.6);
  });
});

describe("edge cases", () => {
  it("does not save the speed while Remember playback speed is off", () => {
    useSettingsStore.setState({ rememberPlaybackRate: false, lastPlaybackRate: 0.9 });
    useAudioStore.getState().setPlaybackRate(1.5);
    expect(useSettingsStore.getState().lastPlaybackRate).toBe(0.9);
  });

  it("saves nothing for an invalid speed", () => {
    useSettingsStore.setState({ lastPlaybackRate: 0.9 });
    useAudioStore.getState().setPlaybackRate(0);
    useAudioStore.getState().setPlaybackRate(-1);
    useAudioStore.getState().setPlaybackRate(Number.NaN);
    expect(useSettingsStore.getState().lastPlaybackRate).toBe(0.9);
  });

  it("toggles from a remembered normal speed to the first other speed", () => {
    useSettingsStore.setState({ lastPlaybackRate: 1 });
    startSession();
    expect(toggledPlaybackRate()).toBe(0.75);
  });

  it("toggles from a remembered other speed back to normal and then to it again", () => {
    useSettingsStore.setState({ lastPlaybackRate: 0.6 });
    startSession();
    expect(toggledPlaybackRate()).toBe(1);
    useAudioStore.getState().setPlaybackRate(1);
    expect(toggledPlaybackRate()).toBe(0.6);
  });
});

describe("settings migration", () => {
  it("regression: an existing user keeps the speed they last used", () => {
    const migrated = migrateSettings({ ...DEFAULTS, defaultPlaybackRate: 1.1, lastPlaybackRate: undefined }, 8) as {
      lastPlaybackRate: number;
      defaultPlaybackRate: number;
      rememberPlaybackRate: boolean;
    };
    expect(migrated.lastPlaybackRate).toBe(1.1);
    expect(migrated.defaultPlaybackRate).toBe(1.1);
    expect(migrated.rememberPlaybackRate).toBe(true);
  });

  it("leaves a saved last speed alone at the current version", () => {
    const migrated = migrateSettings({ ...DEFAULTS, defaultPlaybackRate: 1.1, lastPlaybackRate: 0.8 }, 9) as {
      lastPlaybackRate: number;
    };
    expect(migrated.lastPlaybackRate).toBe(0.8);
  });
});

describe("invariants", () => {
  it("keeps the default playback rate fixed through any sequence of speed changes", () => {
    const before = useSettingsStore.getState().defaultPlaybackRate;
    for (const rate of [0.5, 1, 1.25, 2, 0.75, 1]) useAudioStore.getState().setPlaybackRate(rate);
    expect(useSettingsStore.getState().defaultPlaybackRate).toBe(before);
    expect(useSettingsStore.getState().lastPlaybackRate).toBe(1);
  });
});
