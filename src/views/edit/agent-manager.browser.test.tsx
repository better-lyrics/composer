import { describe, expect, it } from "vitest";
import { AgentManager } from "@/views/edit/agent-manager";
import { useProjectStore } from "@/stores/project";
import { DEFAULT_AGENTS } from "@/domain/agent/colors";
import { createLine } from "@/test/factories";
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

  it("labels the agent name input in the edit popover", async () => {
    useProjectStore.setState({ agents: [...DEFAULT_AGENTS] });
    const screen = await render(<AgentManager />);
    await screen.getByRole("button", { name: /v1/ }).click();
    await expect.element(screen.getByRole("textbox", { name: "Agent name" })).toBeInTheDocument();
  });

  it("labels the custom agent name input in the add popover", async () => {
    useProjectStore.setState({ agents: [...DEFAULT_AGENTS] });
    const screen = await render(<AgentManager />);
    await screen.getByRole("button", { name: /Add/ }).click();
    await expect.element(screen.getByRole("textbox", { name: "Custom agent name" })).toBeInTheDocument();
  });

  it("regression: deleting an agent reassigns its lines, and one undo restores both the agent and the lines", async () => {
    useProjectStore.setState({
      agents: [
        { id: "v1", name: "Lead", type: "person" },
        { id: "v3", name: "Carol", type: "person" },
      ],
    });
    useProjectStore.getState().setLinesWithHistory([createLine({ id: "a", agentId: "v3" })]);
    const screen = await render(<AgentManager />);

    await screen.getByRole("button", { name: /v3/ }).click();
    const trash = document.querySelector<HTMLButtonElement>("button:has(.tabler-icon-trash)");
    if (!trash) throw new Error("no delete button in the agent popover");
    trash.click();

    await expect.poll(() => useProjectStore.getState().agents.map((agent) => agent.id)).toEqual(["v1"]);
    expect(useProjectStore.getState().lines[0].agentId).toBe("v1");

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().agents.map((agent) => agent.id)).toEqual(["v1", "v3"]);
    expect(useProjectStore.getState().lines[0].agentId).toBe("v3");
  });

  it("changes an agent's type via the type select and persists on save", async () => {
    useProjectStore.setState({ agents: [{ id: "v1", name: "Lead", type: "person" }] });
    const screen = await render(<AgentManager />);
    await screen.getByRole("button", { name: /v1/ }).click();
    await screen.getByRole("button", { name: "Agent type" }).click();
    await screen.getByRole("option", { name: "Group" }).click();
    await screen.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => useProjectStore.getState().agents.find((a) => a.id === "v1")?.type).toBe("group");
  });

  it("creates a custom agent with the chosen type", async () => {
    useProjectStore.setState({ agents: [{ id: "v1", name: "Lead", type: "person" }] });
    const screen = await render(<AgentManager />);
    await screen.getByRole("button", { name: /Add/ }).click();
    await screen.getByRole("textbox", { name: "Custom agent name" }).fill("Choir");
    await screen.getByRole("button", { name: "Custom agent type" }).click();
    await screen.getByRole("option", { name: "Group" }).click();
    await screen.getByRole("button", { name: "Add Custom Agent" }).click();
    await expect.poll(() => useProjectStore.getState().agents.find((a) => a.name === "Choir")?.type).toBe("group");
  });

  it("names the icon-only delete button", async () => {
    useProjectStore.setState({
      agents: [
        { id: "v1", name: "Lead", type: "person" },
        { id: "v3", name: "Carol", type: "person" },
      ],
    });
    const screen = await render(<AgentManager />);
    await screen.getByRole("button", { name: /v3/ }).click();
    await expect.element(screen.getByRole("button", { name: "Delete agent" })).toBeInTheDocument();
  });
});
