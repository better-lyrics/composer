import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { createAudioFile } from "@/test/audio-fixtures";
import { isMac } from "@/utils/platform";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";

async function renderEditorShortcuts(): Promise<void> {
  await renderHook(() =>
    useGlobalShortcuts({ setActiveTab: () => {}, setHelpOpen: () => {}, setSettingsOpen: () => {} }),
  );
}

describe("useGlobalShortcuts · seek", () => {
  function pressSeek(target: EventTarget, key: "<" | ">", init: KeyboardEventInit = {}): void {
    const code = key === "<" ? "Comma" : "Period";
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, code, shiftKey: true, bubbles: true, cancelable: true, ...init }),
    );
  }

  async function renderWithSong(): Promise<void> {
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() }, duration: 60, currentTime: 10 });
    useSettingsStore.setState({ seekStep: 3 });
    await renderEditorShortcuts();
  }

  it("seeks forward and back by the seek step, and keeps seeking while held", async () => {
    await renderWithSong();
    pressSeek(window, ">");
    expect(useAudioStore.getState().currentTime).toBe(13);
    pressSeek(window, "<");
    pressSeek(window, "<", { repeat: true });
    expect(useAudioStore.getState().currentTime).toBe(7);
  });

  it("seeks from inside a text field only with Mod held", async () => {
    await renderWithSong();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    try {
      textarea.focus();
      pressSeek(textarea, "<");
      expect(useAudioStore.getState().currentTime).toBe(10);
      pressSeek(textarea, "<", { metaKey: isMac, ctrlKey: !isMac });
      expect(useAudioStore.getState().currentTime).toBe(7);
    } finally {
      textarea.remove();
    }
  });
});
