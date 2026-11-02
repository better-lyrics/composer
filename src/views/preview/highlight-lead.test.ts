import { highlightLeadTrims } from "@/views/preview/highlight-lead";
import { describe, expect, it } from "vitest";

const BRACCATO_LEADS = { richsync: 0.15, line: 0.115 };

describe("highlightLeadTrims", () => {
  it("trims the whole lead while paused, at any rate", () => {
    expect(highlightLeadTrims(BRACCATO_LEADS, 1, false)).toEqual({ richsyncOffsetTrim: 0.15, lineOffsetTrim: 0.115 });
    expect(highlightLeadTrims(BRACCATO_LEADS, 0.5, false)).toEqual({ richsyncOffsetTrim: 0.15, lineOffsetTrim: 0.115 });
  });

  it("keeps the whole lead while playing at 1x", () => {
    expect(highlightLeadTrims(BRACCATO_LEADS, 1, true)).toEqual({ richsyncOffsetTrim: 0, lineOffsetTrim: 0 });
  });

  it("keeps the lead constant in wall-clock time at other rates", () => {
    const trims = highlightLeadTrims(BRACCATO_LEADS, 0.5, true);
    expect((BRACCATO_LEADS.richsync - trims.richsyncOffsetTrim) / 0.5).toBeCloseTo(0.15);
    expect((BRACCATO_LEADS.line - trims.lineOffsetTrim) / 0.5).toBeCloseTo(0.115);
  });
});
