/**
 * @vitest-environment node
 */
import { useProjectStore } from "@/stores/project";
import { toast } from "sonner";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteGroup } from "@/views/timeline/delete-group";

beforeEach(() => {
  useProjectStore.getState().reset();
  useProjectStore.getState().clearHistory();
});

function seedChorusGroup() {
  useProjectStore.setState({
    groups: [{ id: "g1", label: "Chorus", color: "#f472b6", templateVersion: 1 }],
    lines: [
      {
        id: "a0",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 0,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 30, end: 30.4 },
          { text: "love ", begin: 30.4, end: 30.8 },
          { text: "you", begin: 30.8, end: 31.2 },
        ],
      },
      {
        id: "a1",
        text: "I love you",
        agentId: "v1",
        groupId: "g1",
        instanceIdx: 1,
        templateLineIdx: 0,
        words: [
          { text: "I ", begin: 60, end: 60.4 },
          { text: "love ", begin: 60.4, end: 60.8 },
          { text: "you", begin: 60.8, end: 61.2 },
        ],
      },
    ],
  });
}

function groupDeletedToastCountSince(baseline: number): number {
  return toast
    .getHistory()
    .slice(baseline)
    .filter((entry) => "title" in entry && entry.title === "Group deleted").length;
}

describe("deleteGroup", () => {
  it("removes the group and clears group fields on its lines", () => {
    seedChorusGroup();

    deleteGroup("g1");

    expect(useProjectStore.getState().groups).toHaveLength(0);
    expect(useProjectStore.getState().lines.find((l) => l.id === "a0")?.groupId).toBeUndefined();
    expect(useProjectStore.getState().lines.find((l) => l.id === "a1")?.instanceIdx).toBeUndefined();
  });

  it("fires a group-action toast announcing the deletion", () => {
    seedChorusGroup();
    const baseline = toast.getHistory().length;

    deleteGroup("g1");

    expect(groupDeletedToastCountSince(baseline)).toBe(1);
  });

  it("keeps the lines' text and timing intact after dissolving the group", () => {
    seedChorusGroup();

    deleteGroup("g1");

    const a0 = useProjectStore.getState().lines.find((l) => l.id === "a0");
    expect(a0?.text).toBe("I love you");
    expect(a0?.words?.[0].begin).toBe(30);
    expect(a0?.words?.[2].end).toBe(31.2);
  });
});
