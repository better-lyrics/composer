import { flushSync } from "react-dom";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { createLine } from "@/test/factories";

// -- Helpers ------------------------------------------------------------------

function loadPlayingProject(text = "Hello world"): void {
  useAudioStore.setState({
    source: { type: "file", file: createAudioFile() },
    duration: 10,
    currentTime: 5,
    isPlaying: true,
  });
  useProjectStore.setState({ lines: [createLine({ text })], activeTab: "sync" });
}

function firePointer(element: Element, type: string, pointerId = 1): PointerEvent {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId });
  element.dispatchEvent(event);
  return event;
}

// Playback commits a render between a real press and its release; flushSync
// reproduces that so the release handler reads the advanced clock.
function setCurrentTime(seconds: number): void {
  flushSync(() => {
    useAudioStore.setState({ currentTime: seconds });
  });
}

function setIsPlaying(isPlaying: boolean): void {
  flushSync(() => {
    useAudioStore.setState({ isPlaying });
  });
}

// -- Exports ------------------------------------------------------------------

export { loadPlayingProject, firePointer, setCurrentTime, setIsPlaying };
