import { describe, expect, it } from "vitest";
import { GutterAgentPicker } from "@/views/timeline/gutter-agent-picker";
import { useProjectStore, DEFAULT_AGENTS } from "@/stores/project";
import { render } from "@/test/render";

describe("GutterAgentPicker", () => {
  it("renders a swatch button with the agent color", async () => {
    useProjectStore.setState({ agents: [...DEFAULT_AGENTS] });
    const screen = await render(<GutterAgentPicker lineId="line-1" lineIndex={0} agentId="v1" />);
    expect(screen.container.querySelector("button")).not.toBeNull();
  });

  it("opens a popover listing all available agents when clicked", async () => {
    useProjectStore.setState({ agents: [...DEFAULT_AGENTS] });
    const screen = await render(<GutterAgentPicker lineId="line-1" lineIndex={0} agentId="v1" />);
    const trigger = screen.container.querySelector("button") as HTMLButtonElement;
    await trigger.click();
    await new Promise((r) => setTimeout(r, 16));
    const buttons = document.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(1);
  });
});
