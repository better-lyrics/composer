import { describe, expect, it } from "vitest";
import { AgentManager } from "@/views/edit/agent-manager";
import { DEFAULT_AGENTS, useProjectStore } from "@/stores/project";
import { render } from "@/test/render";

describe("AgentManager", () => {
  it("renders one badge per agent in the project store", async () => {
    useProjectStore.setState({ agents: [...DEFAULT_AGENTS] });
    const screen = await render(<AgentManager />);
    for (const agent of DEFAULT_AGENTS) {
      expect(screen.container.textContent).toContain(agent.id);
    }
  });

  it("renders the Add button to create new agents", async () => {
    useProjectStore.setState({ agents: [...DEFAULT_AGENTS] });
    const screen = await render(<AgentManager />);
    await expect.element(screen.getByRole("button", { name: /Add/ })).toBeInTheDocument();
  });
});
