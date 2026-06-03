import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

describe("rollingEditMode", () => {
  it("defaults to off and toggles", () => {
    useTimelineStore.setState({ rollingEditMode: false });
    expect(useTimelineStore.getState().rollingEditMode).toBe(false);
    useTimelineStore.getState().toggleRollingEditMode();
    expect(useTimelineStore.getState().rollingEditMode).toBe(true);
  });
});

describe("primaryWordText", () => {
  beforeEach(() => {
    useProjectStore.setState(useProjectStore.getInitialState());
    useTimelineStore.setState({ primaryWordText: "source" });
  });

  it("defaults to 'source'", () => {
    expect(useTimelineStore.getState().primaryWordText).toBe("source");
  });

  it("setPrimaryWordText updates the field and mirrors into project metadata", () => {
    useTimelineStore.getState().setPrimaryWordText("romaji");
    expect(useTimelineStore.getState().primaryWordText).toBe("romaji");
    expect(useProjectStore.getState().metadata.timelinePrimaryWordText).toBe("romaji");
  });

  it("togglePrimaryWordText cycles source -> romaji -> source and mirrors each step into metadata", () => {
    useTimelineStore.getState().togglePrimaryWordText();
    expect(useTimelineStore.getState().primaryWordText).toBe("romaji");
    expect(useProjectStore.getState().metadata.timelinePrimaryWordText).toBe("romaji");

    useTimelineStore.getState().togglePrimaryWordText();
    expect(useTimelineStore.getState().primaryWordText).toBe("source");
    expect(useProjectStore.getState().metadata.timelinePrimaryWordText).toBe("source");
  });

  it("mirrors metadata.timelinePrimaryWordText changes back into the timeline store", () => {
    useProjectStore.getState().setMetadata({ timelinePrimaryWordText: "romaji" });
    expect(useTimelineStore.getState().primaryWordText).toBe("romaji");
  });

  it("resets to 'source' when metadata.timelinePrimaryWordText is cleared", () => {
    useTimelineStore.getState().setPrimaryWordText("romaji");
    useProjectStore.getState().setMetadata({ timelinePrimaryWordText: undefined });
    expect(useTimelineStore.getState().primaryWordText).toBe("source");
  });
});
