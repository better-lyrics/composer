import { usePersistence } from "@/hooks/usePersistence";
import { DB_NAME, DB_VERSION } from "@/lib/persistence-idb";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { getSaveStatus } from "@/lib/save-status";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { createAudioFile } from "@/test/audio-fixtures";
import { allowConsole } from "@/test/console-guard";
import { createLine } from "@/test/factories";
import { deleteDatabase, openAndCloseAtVersion } from "@/test/idb";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const PersistenceHost: React.FC = () => {
  usePersistence();
  return null;
};

function leavePrompted(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function renderSettled(): Promise<void> {
  await render(<PersistenceHost />);
  await getPersistenceSettled();
}

function editLyrics(): void {
  useProjectStore.getState().setLines([createLine({ text: "Hello world", begin: 1, end: 2 })]);
}

// -- Tests --------------------------------------------------------------------

describe("usePersistence: leave prompt", () => {
  it("asks before leaving while a lyrics edit is waiting to save", async () => {
    await renderSettled();
    editLyrics();
    expect(getSaveStatus()).toBe("saving");
    expect(leavePrompted()).toBe(true);
  });

  it("lets the tab close without asking once everything is saved", async () => {
    await renderSettled();
    editLyrics();
    leavePrompted();
    await expect.poll(() => getSaveStatus()).toBe("saved");
    expect(leavePrompted()).toBe(false);
  });

  describe("edge cases", () => {
    it("does not ask on a fresh app with nothing to save", async () => {
      await renderSettled();
      expect(leavePrompted()).toBe(false);
    });

    it("asks while an audio file is still being written", async () => {
      await renderSettled();
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
      expect(leavePrompted()).toBe(true);
      await expect.poll(() => getSaveStatus()).toBe("saved");
      expect(leavePrompted()).toBe(false);
    });
  });

  describe("error paths", () => {
    it("asks while the last save failed", async () => {
      allowConsole(/audio save failed/);
      await renderSettled();
      await openAndCloseAtVersion(DB_NAME, DB_VERSION + 1);
      useAudioStore.getState().setSource({ type: "file", file: createAudioFile("alpha.wav") });
      await expect.poll(() => getSaveStatus()).toBe("failed");
      expect(leavePrompted()).toBe(true);
      await deleteDatabase(DB_NAME);
    });
  });

  describe("regressions", () => {
    it("regression: does not ask after lyrics were edited and saved, though the project stays dirty", async () => {
      await renderSettled();
      editLyrics();
      leavePrompted();
      await expect.poll(() => getSaveStatus()).toBe("saved");
      expect(useProjectStore.getState().isDirty).toBe(true);
      expect(leavePrompted()).toBe(false);
    });
  });
});
