import { beforeEach, describe, expect, it } from "vitest";
import { usePersistence } from "@/hooks/usePersistence";
import { loadCurrentProject } from "@/lib/persistence";
import { cancelPendingSave } from "@/lib/persistence-debounce";
import { getPersistenceSettled } from "@/lib/persistence-settled";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { seedProject } from "@/test/idb";
import { render } from "@/test/render";

// -- Test infrastructure ------------------------------------------------------

const HookHost: React.FC = () => {
  usePersistence();
  return null;
};

// Tighten the debounce to 0 so save side-effects land within the test window.
function fastSaves(): void {
  useSettingsStore.getState().set("autoSaveDelay", 0);
}

function seedSavedProject(currentStem?: "original" | "vocals" | "instrumental"): Promise<void> {
  return seedProject({
    version: 1,
    savedAt: Date.now(),
    metadata: { title: "Seeded Song", artist: "", album: "", duration: 0 },
    lines: [],
    agents: [{ id: "v1", type: "person", name: "Lead" }],
    granularity: "word",
    ...(currentStem ? { currentStem } : {}),
  });
}

async function pollSavedStem(): Promise<"original" | "vocals" | "instrumental" | undefined> {
  const saved = await loadCurrentProject();
  return saved?.currentStem;
}

beforeEach(() => {
  cancelPendingSave();
});

// -- Load: restore saved stem -------------------------------------------------

describe("usePersistence:load: restore saved stem", () => {
  it("restores 'vocals' when the saved project had vocals selected", async () => {
    await seedSavedProject("vocals");

    await render(<HookHost />);
    await getPersistenceSettled();

    expect(useSeparationStore.getState().currentStem).toBe("vocals");
  });

  it("restores 'instrumental' when the saved project had instrumental selected", async () => {
    await seedSavedProject("instrumental");

    await render(<HookHost />);
    await getPersistenceSettled();

    expect(useSeparationStore.getState().currentStem).toBe("instrumental");
  });

  it("leaves the store at 'original' when the saved project has no currentStem field (older project)", async () => {
    await seedSavedProject();

    await render(<HookHost />);
    await getPersistenceSettled();

    expect(useSeparationStore.getState().currentStem).toBe("original");
  });

  it("leaves the store at 'original' on a cold-start with no saved project", async () => {
    await render(<HookHost />);
    await getPersistenceSettled();

    expect(useSeparationStore.getState().currentStem).toBe("original");
  });
});

// -- Save: stem change triggers persistence -----------------------------------

describe("usePersistence:save: stem changes are persisted", () => {
  it("persists a stem selection made after load", async () => {
    await seedSavedProject();
    await render(<HookHost />);
    await getPersistenceSettled();
    fastSaves();
    useSeparationStore.setState({ availableStems: ["original", "vocals", "instrumental"] });

    useSeparationStore.getState().selectStem("vocals");

    await expect.poll(pollSavedStem).toBe("vocals");
  });

  it("persists the latest stem when the user switches rapidly", async () => {
    await seedSavedProject();
    await render(<HookHost />);
    await getPersistenceSettled();
    fastSaves();
    useSeparationStore.setState({ availableStems: ["original", "vocals", "instrumental"] });

    const { selectStem } = useSeparationStore.getState();
    selectStem("vocals");
    selectStem("instrumental");
    selectStem("original");

    await expect.poll(pollSavedStem).toBe("original");
  });

  it("does not change the stored stem when selectStem is called with an unavailable stem", async () => {
    await seedSavedProject("original");
    await render(<HookHost />);
    await getPersistenceSettled();
    fastSaves();
    // availableStems intentionally not expanded; "vocals" is not selectable.

    useSeparationStore.getState().selectStem("vocals");

    // selectStem silently no-ops; currentStem stays at "original" so no save
    // delta. We poll briefly: the value should remain "original" the whole time.
    await expect.poll(pollSavedStem).toBe("original");
    expect(useSeparationStore.getState().currentStem).toBe("original");
  });
});

// -- Boundary: stale projects without the field -----------------------------

describe("usePersistence:saved project field shape", () => {
  it("writes currentStem into the saved project record", async () => {
    await seedSavedProject();
    await render(<HookHost />);
    await getPersistenceSettled();
    fastSaves();
    useSeparationStore.setState({ availableStems: ["original", "vocals", "instrumental"] });

    useSeparationStore.getState().selectStem("instrumental");

    await expect.poll(async () => (await loadCurrentProject())?.currentStem).toBe("instrumental");
  });
});
