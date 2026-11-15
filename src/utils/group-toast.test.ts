/**
 * @vitest-environment jsdom
 */

import { toast } from "sonner";
import { describe, expect, it } from "vitest";
import { showSplitInAllInstancesToast } from "@/utils/group-toast";

describe("group toasts", () => {
  it("regression: the split in all instances notice offers Undo", () => {
    const baseline = toast.getHistory().length;
    showSplitInAllInstancesToast(3);
    const [shown] = toast.getHistory().slice(baseline);
    expect(shown && "action" in shown && shown.action).toMatchObject({ label: "Undo" });
  });
});
