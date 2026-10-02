import { AudioEngine } from "@/audio/audio-engine";
import { useAudioStore } from "@/stores/audio";
import { createAudioFile } from "@/test/audio-fixtures";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

async function playableAudio(): Promise<HTMLAudioElement> {
  await render(<AudioEngine />);
  useAudioStore.setState({ source: { type: "file", file: createAudioFile("silence.wav", 30) } });
  await expect.poll(() => useAudioStore.getState().audioElement).not.toBeNull();
  const audio = useAudioStore.getState().audioElement as HTMLAudioElement;
  await expect.poll(() => audio.readyState).toBeGreaterThanOrEqual(HTMLMediaElement.HAVE_FUTURE_DATA);
  audio.muted = true;
  return audio;
}

function countPlayStateWrites(): { count: () => number; stop: () => void } {
  let writes = 0;
  const stop = useAudioStore.subscribe((state, previous) => {
    if (state.isPlaying !== previous.isPlaying) writes++;
  });
  return { count: () => writes, stop };
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Tests --------------------------------------------------------------------

describe("AudioEngine play state", () => {
  it("plays and pauses with the store", async () => {
    const audio = await playableAudio();
    useAudioStore.getState().setIsPlaying(true);
    await expect.poll(() => audio.paused).toBe(false);
    useAudioStore.getState().setIsPlaying(false);
    await expect.poll(() => audio.paused).toBe(true);
  });

  it("follows the element when it starts or stops on its own, such as from media keys", async () => {
    const audio = await playableAudio();
    await audio.play();
    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(true);
    audio.pause();
    await expect.poll(() => useAudioStore.getState().isPlaying).toBe(false);
  });

  it("does not write the play state again for a play event it already shows", async () => {
    const audio = await playableAudio();
    useAudioStore.getState().setIsPlaying(true);
    await expect.poll(() => audio.paused).toBe(false);
    await settle(200);
    const writes = countPlayStateWrites();
    audio.dispatchEvent(new Event("play"));
    audio.dispatchEvent(new Event("play"));
    writes.stop();
    expect(writes.count()).toBe(0);
  });

  describe("regressions", () => {
    it("regression: play then an immediate pause does not flip between playing and paused forever", async () => {
      const audio = await playableAudio();
      const writes = countPlayStateWrites();
      useAudioStore.getState().setIsPlaying(true);
      await expect.poll(() => audio.paused).toBe(false);
      useAudioStore.getState().setIsPlaying(false);
      await settle(600);
      const afterSettle = writes.count();
      await settle(600);
      writes.stop();
      expect(writes.count()).toBe(afterSettle);
      expect(useAudioStore.getState().isPlaying).toBe(false);
      expect(audio.paused).toBe(true);
    });

    it("regression: pause then an immediate play does not flip between playing and paused forever", async () => {
      const audio = await playableAudio();
      useAudioStore.getState().setIsPlaying(true);
      await expect.poll(() => audio.paused).toBe(false);
      await settle(200);
      const writes = countPlayStateWrites();
      useAudioStore.getState().setIsPlaying(false);
      await expect.poll(() => audio.paused).toBe(true);
      useAudioStore.getState().setIsPlaying(true);
      await settle(600);
      const afterSettle = writes.count();
      await settle(600);
      writes.stop();
      expect(writes.count()).toBe(afterSettle);
      expect(useAudioStore.getState().isPlaying).toBe(true);
      expect(audio.paused).toBe(false);
    });
  });
});
