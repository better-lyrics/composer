import { render } from "@/test/render";
import { SyncFooter } from "@/views/sync/sync-footer";
import { describe, expect, it } from "vitest";

const PAUSED_TEXT = "Paused ・ Click a line to jump, or play to continue";

function footer(status?: React.ReactNode) {
  return (
    <SyncFooter isComplete={false} editMode={false} isPlaying={false} isActive gestureControls={null} status={status} />
  );
}

describe("SyncFooter", () => {
  it("shows the paused hint while a session is paused", async () => {
    const screen = await render(footer());
    await expect.element(screen.getByText(PAUSED_TEXT)).toBeInTheDocument();
  });

  it("shows a status in place of the paused hint", async () => {
    const screen = await render(footer(<span>Starting soon</span>));
    await expect.element(screen.getByText("Starting soon")).toBeInTheDocument();
    await expect.element(screen.getByText(PAUSED_TEXT)).not.toBeInTheDocument();
  });
});
