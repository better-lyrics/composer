/**
 * @vitest-environment node
 */
import type { LinkGroup } from "@/domain/group/template";
import { reconcileLine } from "@/domain/line/model";
import { bgVoice } from "@/domain/line/voices";
import { useConfirmStore } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { removeBackgroundWithConfirm } from "./remove-background-with-confirm";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
  useConfirmStore.setState({ isOpen: false, options: null, resolve: null, queue: [] });
  useSettingsStore.setState({ confirmRemoveBackground: true });
});

function seedGroup(id: string): LinkGroup {
  return { id, label: "Chorus", color: "#f472b6", templateVersion: 1 };
}

function seedStandalone() {
  useProjectStore.setState({
    lines: [reconcileLine({ id: "L1", text: "Real line", agentId: "v1", backgroundText: "ooh" })],
  });
}

function seedLinkedPair() {
  useProjectStore.setState({
    groups: [seedGroup("g1")],
    lines: [
      reconcileLine({
        id: "a0",
        text: "Real line",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        backgroundText: "ooh ooh",
        backgroundTextSource: "manual",
      }),
      reconcileLine({
        id: "a1",
        text: "Real line",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        backgroundText: "ooh ooh",
        backgroundTextSource: "manual",
      }),
    ],
  });
}

function getLine(id: string) {
  const line = useProjectStore.getState().lines.find((l) => l.id === id);
  if (!line) throw new Error(`line ${id} not found`);
  return line;
}

function descriptionText(): string {
  const description = useConfirmStore.getState().options?.description as ReactNode;
  return typeof description === "string" ? description : "";
}

describe("removeBackgroundWithConfirm · confirm accepted", () => {
  it("removes the background once the confirm resolves true", async () => {
    seedStandalone();

    const done = removeBackgroundWithConfirm("L1");
    expect(useConfirmStore.getState().isOpen).toBe(true);
    useConfirmStore.getState().resolveAndClose(true, false);
    await done;

    expect(bgVoice(getLine("L1"))).toBeNull();
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it("clears every linked instance's background when accepted", async () => {
    seedLinkedPair();

    const done = removeBackgroundWithConfirm("a0");
    useConfirmStore.getState().resolveAndClose(true, false);
    await done;

    expect(bgVoice(getLine("a0"))).toBeNull();
    expect(bgVoice(getLine("a1"))).toBeNull();
  });
});

describe("removeBackgroundWithConfirm · confirm cancelled", () => {
  it("leaves the line untouched when cancelled", async () => {
    seedStandalone();
    const before = useProjectStore.getState().lines;

    const done = removeBackgroundWithConfirm("L1");
    useConfirmStore.getState().resolveAndClose(false, false);
    await done;

    expect(useProjectStore.getState().lines).toEqual(before);
    expect(bgVoice(getLine("L1"))).not.toBeNull();
  });
});

describe("removeBackgroundWithConfirm · confirm options", () => {
  it("opens a destructive, recoverable confirm gated on confirmRemoveBackground", () => {
    seedStandalone();

    void removeBackgroundWithConfirm("L1");

    const options = useConfirmStore.getState().options;
    expect(options?.title).toBe("Remove background vocals?");
    expect(options?.confirmLabel).toBe("Remove background");
    expect(options?.variant).toBe("destructive");
    expect(options?.settingsKey).toBe("confirmRemoveBackground");
    expect(options?.recoverable).toBe(true);

    useConfirmStore.getState().resolveAndClose(false, false);
  });

  it("uses the standalone description when the line has no linked siblings", () => {
    seedStandalone();

    void removeBackgroundWithConfirm("L1");

    expect(descriptionText()).toBe("The background vocals on this line will be removed.");

    useConfirmStore.getState().resolveAndClose(false, false);
  });

  it("uses the linked-instance description when the line has linked siblings", () => {
    seedLinkedPair();

    void removeBackgroundWithConfirm("a0");

    expect(descriptionText()).toBe("The background vocals on this line and its linked instances will be removed.");

    useConfirmStore.getState().resolveAndClose(false, false);
  });
});

describe("removeBackgroundWithConfirm · setting gate", () => {
  it("removes immediately without opening when the setting is off", async () => {
    seedStandalone();
    useSettingsStore.setState({ confirmRemoveBackground: false });

    await removeBackgroundWithConfirm("L1");

    expect(useConfirmStore.getState().isOpen).toBe(false);
    expect(bgVoice(getLine("L1"))).toBeNull();
  });
});

describe("removeBackgroundWithConfirm · no background", () => {
  it("returns early without opening a confirm when the line has no bg", async () => {
    useProjectStore.setState({
      lines: [
        reconcileLine({ id: "L1", text: "Real line", agentId: "v1", words: [{ text: "Real line", begin: 0, end: 2 }] }),
      ],
    });

    await removeBackgroundWithConfirm("L1");

    expect(useConfirmStore.getState().isOpen).toBe(false);
    expect(useConfirmStore.getState().options).toBeNull();
  });

  it("returns early without opening a confirm for a missing line", async () => {
    seedStandalone();

    await removeBackgroundWithConfirm("nope");

    expect(useConfirmStore.getState().isOpen).toBe(false);
    expect(useConfirmStore.getState().options).toBeNull();
  });
});
