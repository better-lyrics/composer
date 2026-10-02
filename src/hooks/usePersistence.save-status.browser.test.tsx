import { describe, expect, it } from "vitest";
import { usePersistence } from "@/hooks/usePersistence";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { getSaveStatus } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

// -- Tests --------------------------------------------------------------------

describe("usePersistence: save status", () => {
  it("dropping an audio file moves the status through saving to saved", async () => {
    await render(<PersistenceHost />);
    await getPersistenceSettled();
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
    expect(getSaveStatus()).toBe("saving");
    await expect.poll(() => getSaveStatus()).toBe("saved");
  });

  it("clearing the audio file also moves the status", async () => {
    await render(<PersistenceHost />);
    await getPersistenceSettled();
    useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
    await expect.poll(() => getSaveStatus()).toBe("saved");
    useAudioStore.getState().setSource(null);
    expect(getSaveStatus()).toBe("saving");
    await expect.poll(() => getSaveStatus()).toBe("saved");
  });

  describe("regressions", () => {
    it("regression: a rejected audio save is reported as failed", async () => {
      allowConsole(/audio save failed/);
      await render(<PersistenceHost />);
      await getPersistenceSettled();
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
      await expect.poll(() => getSaveStatus()).toBe("failed");
      await deleteDatabase(DB_NAME);
    });
  });
});
