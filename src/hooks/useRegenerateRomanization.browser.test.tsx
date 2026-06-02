import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import type { RomanizationGenerator } from "@/domain/romanization/registry";
import {
  clearGeneratorRegistry,
  registerGeneratorFactory,
  restoreGeneratorRegistry,
  snapshotGeneratorRegistry,
} from "@/domain/romanization/registry";
import { useRegenerateRomanization } from "@/hooks/useRegenerateRomanization";
import { useProjectStore } from "@/stores/project";
import { clearGeneratorCacheForTests } from "@/utils/romanization/generate-for-line";

// -- Helpers ------------------------------------------------------------------

function buildPassthroughGenerator(scheme: string): RomanizationGenerator {
  return {
    scheme,
    async generateLine(line) {
      return { text: `r:${line.text}` };
    },
  };
}

let registrySnapshot: ReturnType<typeof snapshotGeneratorRegistry> = new Map();

beforeEach(() => {
  registrySnapshot = snapshotGeneratorRegistry();
  clearGeneratorRegistry();
  clearGeneratorCacheForTests();
  useProjectStore.getState().clearHistory();
});

afterEach(() => {
  restoreGeneratorRegistry(registrySnapshot);
  clearGeneratorCacheForTests();
});

// -- Tests --------------------------------------------------------------------

describe("useRegenerateRomanization", () => {
  it("writes generated romanization via setLineRomanizationWithHistory", async () => {
    registerGeneratorFactory("ja-Latn-hepburn", async () => buildPassthroughGenerator("ja-Latn-hepburn"));
    useProjectStore.getState().setLines([{ id: "L1", text: "夜だけど", agentId: "v1" }]);
    useProjectStore.getState().clearHistory();

    const { result, act } = await renderHook(() => useRegenerateRomanization("ja-Latn-hepburn"));

    await act(async () => {
      await result.current.regenerate(useProjectStore.getState().lines[0]);
    });

    const line = useProjectStore.getState().lines[0];
    expect(line.romanization?.text).toBe("r:夜だけど");
    expect(line.romanization?.source).toBe("generated");
    expect(useProjectStore.getState().canUndo()).toBe(true);
  });

  it("toggles isBusy(lineId) true while in-flight and false after settle", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    registerGeneratorFactory("ja-Latn-hepburn", async () => ({
      scheme: "ja-Latn-hepburn",
      async generateLine(line) {
        await gate;
        return { text: `r:${line.text}` };
      },
    }));
    useProjectStore.getState().setLines([{ id: "L1", text: "夜だけど", agentId: "v1" }]);

    const { result } = await renderHook(() => useRegenerateRomanization("ja-Latn-hepburn"));
    expect(result.current.isBusy("L1")).toBe(false);

    const pending = result.current.regenerate(useProjectStore.getState().lines[0]);
    await expect.poll(() => result.current.isBusy("L1")).toBe(true);

    release();
    await pending;
    await expect.poll(() => result.current.isBusy("L1")).toBe(false);
  });

  it("does nothing when scheme is undefined", async () => {
    useProjectStore.getState().setLines([{ id: "L1", text: "夜だけど", agentId: "v1" }]);

    const { result } = await renderHook(() => useRegenerateRomanization(undefined));

    await result.current.regenerate(useProjectStore.getState().lines[0]);

    expect(useProjectStore.getState().lines[0].romanization).toBeUndefined();
  });

  it("tracks multiple in-flight lines independently in isBusy", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    registerGeneratorFactory("ja-Latn-hepburn", async () => ({
      scheme: "ja-Latn-hepburn",
      async generateLine(line) {
        await gate;
        return { text: `r:${line.text}` };
      },
    }));
    useProjectStore.getState().setLines([
      { id: "L1", text: "夜だけど", agentId: "v1" },
      { id: "L2", text: "メモリー", agentId: "v1" },
    ]);

    const { result } = await renderHook(() => useRegenerateRomanization("ja-Latn-hepburn"));

    const pendingL1 = result.current.regenerate(useProjectStore.getState().lines[0]);
    const pendingL2 = result.current.regenerate(useProjectStore.getState().lines[1]);

    await expect.poll(() => result.current.isBusy("L1")).toBe(true);
    await expect.poll(() => result.current.isBusy("L2")).toBe(true);
    expect(result.current.isBusy("L3")).toBe(false);

    release();
    await Promise.all([pendingL1, pendingL2]);
    await expect.poll(() => result.current.isBusy("L1")).toBe(false);
    await expect.poll(() => result.current.isBusy("L2")).toBe(false);
  });
});
