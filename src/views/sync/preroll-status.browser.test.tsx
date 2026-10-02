import { useAudioStore } from "@/stores/audio";
import { render } from "@/test/render";
import { PrerollStatus } from "@/views/sync/preroll-status";
import { describe, expect, it } from "vitest";

describe("PrerollStatus", () => {
  it("names the line the next tap lands on", async () => {
    useAudioStore.setState({ currentTime: 40.5 });
    const screen = await render(<PrerollStatus end={42} seconds={1.5} lineNumber={6} />);
    await expect.element(screen.getByText("Line 6 in", { exact: true })).toBeInTheDocument();
  });

  it("counts the audio time left in tenths", async () => {
    useAudioStore.setState({ currentTime: 40.5 });
    const screen = await render(<PrerollStatus end={42} seconds={1.5} lineNumber={6} />);
    await expect.element(screen.getByText("1.5", { exact: true })).toBeInTheDocument();
    useAudioStore.setState({ currentTime: 41.2 });
    await expect.element(screen.getByText("0.8", { exact: true })).toBeInTheDocument();
  });

  it("announces the line and the whole seconds left", async () => {
    useAudioStore.setState({ currentTime: 40.5 });
    const screen = await render(<PrerollStatus end={42} seconds={1.5} lineNumber={6} />);
    await expect.element(screen.getByRole("status")).toHaveTextContent("Line 6 in 2 seconds");
  });

  describe("edge cases", () => {
    it("rests at zero once the line has started", async () => {
      useAudioStore.setState({ currentTime: 43 });
      const screen = await render(<PrerollStatus end={42} seconds={1.5} lineNumber={6} />);
      await expect.element(screen.getByText("0.0", { exact: true })).toBeInTheDocument();
    });
  });
});
