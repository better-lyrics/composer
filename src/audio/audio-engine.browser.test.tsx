import { describe, expect, it } from "vitest";
import { AudioEngine } from "@/audio/audio-engine";
import { useAudioStore } from "@/stores/audio";
import { createAudioFile, createMp3File } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { render } from "@/test/render";

function waitFor(predicate: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error("waitFor timeout"));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

describe("AudioEngine", () => {
  it("registers an <audio> element on the store when a file source is set", async () => {
    await render(<AudioEngine />);
    expect(useAudioStore.getState().audioElement).toBeNull();
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() } });
    await waitFor(() => useAudioStore.getState().audioElement !== null);
    expect(useAudioStore.getState().audioElement).toBeInstanceOf(HTMLAudioElement);
  });

  it("clears audioElement when the source becomes null", async () => {
    await render(<AudioEngine />);
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() } });
    await waitFor(() => useAudioStore.getState().audioElement !== null);
    useAudioStore.setState({ source: null });
    await waitFor(() => useAudioStore.getState().audioElement === null);
    expect(useAudioStore.getState().audioElement).toBeNull();
  });

  it("propagates playbackRate, volume, and mute changes to the audio element", async () => {
    await render(<AudioEngine />);
    useAudioStore.setState({ source: { type: "file", file: createAudioFile() } });
    await waitFor(() => useAudioStore.getState().audioElement !== null);
    const audio = useAudioStore.getState().audioElement as HTMLAudioElement;

    useAudioStore.setState({ playbackRate: 1.5 });
    await waitFor(() => audio.playbackRate === 1.5);
    expect(audio.playbackRate).toBe(1.5);

    useAudioStore.setState({ volume: 0.25 });
    await waitFor(() => audio.volume === 0.25);
    expect(audio.volume).toBe(0.25);

    useAudioStore.setState({ isMuted: true });
    await waitFor(() => audio.muted === true);
    expect(audio.muted).toBe(true);
  });

  it("decodes an mp3 source and feeds the element a wav blob", async () => {
    await render(<AudioEngine />);
    useAudioStore.setState({ source: { type: "file", file: createMp3File() } });
    await waitFor(() => useAudioStore.getState().audioElement !== null, 5000);
    const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
    const bytes = await (await fetch(audio.src)).arrayBuffer();
    const tag = String.fromCharCode(...new Uint8Array(bytes, 0, 4));
    expect(tag).toBe("RIFF");
  });

  it("falls back to the original file when mp3 decode fails", async () => {
    allowConsole(/mp3 decode failed/);
    allowConsole(/Audio error/);
    await render(<AudioEngine />);
    const garbage = new File([new Uint8Array([1, 2, 3, 4, 5])], "broken.mp3", { type: "audio/mpeg" });
    useAudioStore.setState({ source: { type: "file", file: garbage } });
    await waitFor(() => useAudioStore.getState().audioElement !== null, 5000);
    expect(useAudioStore.getState().audioElement).toBeInstanceOf(HTMLAudioElement);
  });
});
