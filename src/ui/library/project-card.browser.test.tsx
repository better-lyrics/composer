import { userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import type { LibraryProject } from "@/domain/project/library-project";
import { ProjectCard } from "@/ui/library/project-card";
import { createLine } from "@/test/factories";
import { render } from "@/test/render";

// -- Helpers ------------------------------------------------------------------

function makeProject(overrides: Partial<LibraryProject> = {}): LibraryProject {
  return {
    version: 1,
    id: "proj-1",
    metadata: { title: "Sample Song", artist: "Sample Artist", album: "", duration: 200 },
    agents: [],
    lines: [],
    groups: [],
    granularity: "word",
    syllableSplitDefaults: { applyToAll: false, caseInsensitive: false },
    audioBytesCached: false,
    dismissedSuggestions: [],
    dismissedExplicitSuggestions: [],
    currentStem: "original",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
    ...overrides,
  };
}

const noop = () => {};

// -- Tests --------------------------------------------------------------------

describe("ProjectCard", () => {
  it("renders the project title and artist", async () => {
    const project = makeProject({
      metadata: { title: "Bohemian Rhapsody", artist: "Queen", album: "", duration: 354 },
    });
    const screen = await render(<ProjectCard project={project} onOpen={noop} />);
    await expect.element(screen.getByText("Bohemian Rhapsody")).toBeInTheDocument();
    await expect.element(screen.getByText("Queen")).toBeInTheDocument();
  });

  it("renders the thumbnail when metadata.thumbnailDataUrl is present", async () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const project = makeProject({
      metadata: { title: "T", artist: "A", album: "", duration: 100, thumbnailDataUrl: dataUrl },
    });
    const screen = await render(<ProjectCard project={project} onOpen={noop} />);
    const img = screen.container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(dataUrl);
    expect(screen.container.querySelector("svg[aria-label='Waveform']")).toBeNull();
  });

  it("falls back to the waveform when no thumbnail is present", async () => {
    const project = makeProject();
    const screen = await render(<ProjectCard project={project} onOpen={noop} />);
    expect(screen.container.querySelector("img")).toBeNull();
    expect(screen.container.querySelector("svg[aria-label='Waveform']")).not.toBeNull();
  });

  it("calls onOpen with the project id on click", async () => {
    const project = makeProject({ id: "proj-42" });
    const onOpen = vi.fn();
    const screen = await render(<ProjectCard project={project} onOpen={onOpen} />);
    await screen.getByRole("button", { name: "Sample Song" }).click();
    expect(onOpen).toHaveBeenCalledWith("proj-42");
  });

  it("shows the Line sync badge when lines have begin/end only", async () => {
    const project = makeProject({
      lines: [createLine({ text: "a", begin: 0, end: 1 }), createLine({ text: "b", begin: 1, end: 2 })],
    });
    const screen = await render(<ProjectCard project={project} onOpen={noop} />);
    await expect.element(screen.getByLabelText("Line sync")).toBeInTheDocument();
  });

  it("shows the Word sync badge when any line has words timing", async () => {
    const project = makeProject({
      lines: [
        createLine({
          text: "a b",
          words: [
            { text: "a", begin: 0, end: 0.5 },
            { text: "b", begin: 0.5, end: 1 },
          ],
        }),
      ],
    });
    const screen = await render(<ProjectCard project={project} onOpen={noop} />);
    await expect.element(screen.getByLabelText("Word sync")).toBeInTheDocument();
  });

  it("shows the Unsynced badge when no line has timing", async () => {
    const project = makeProject({ lines: [createLine({ text: "a" })] });
    const screen = await render(<ProjectCard project={project} onOpen={noop} />);
    await expect.element(screen.getByLabelText("Unsynced sync")).toBeInTheDocument();
  });

  it("calls onContextMenu on right-click", async () => {
    const project = makeProject({ id: "ctx-id" });
    const onContext = vi.fn();
    const screen = await render(<ProjectCard project={project} onOpen={noop} onContextMenu={onContext} />);
    const button = screen.getByRole("button", { name: "Sample Song" }).element() as HTMLElement;
    button.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(onContext).toHaveBeenCalledTimes(1);
    expect(onContext.mock.calls[0][1]).toBe("ctx-id");
  });

  it("calls onContextMenu when the More button is clicked", async () => {
    const project = makeProject({ id: "more-id" });
    const onContext = vi.fn();
    const screen = await render(<ProjectCard project={project} onOpen={noop} onContextMenu={onContext} />);
    await screen.getByRole("button", { name: /more actions/i }).click();
    expect(onContext).toHaveBeenCalledTimes(1);
    expect(onContext.mock.calls[0][1]).toBe("more-id");
  });

  it("activates onOpen when Enter is pressed on a focused card", async () => {
    const project = makeProject({ id: "kbd-enter" });
    const onOpen = vi.fn();
    const screen = await render(<ProjectCard project={project} onOpen={onOpen} />);
    const card = screen.getByRole("button", { name: "Sample Song" }).element() as HTMLElement;
    card.focus();
    await expect.poll(() => document.activeElement).toBe(card);
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith("kbd-enter");
  });

  it("activates onOpen when Space is pressed on a focused card", async () => {
    const project = makeProject({ id: "kbd-space" });
    const onOpen = vi.fn();
    const screen = await render(<ProjectCard project={project} onOpen={onOpen} />);
    const card = screen.getByRole("button", { name: "Sample Song" }).element() as HTMLElement;
    card.focus();
    await expect.poll(() => document.activeElement).toBe(card);
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenCalledWith("kbd-space");
  });

  describe("edge cases", () => {
    it("renders 'Untitled' when title is empty", async () => {
      const project = makeProject({ metadata: { title: "", artist: "Q", album: "", duration: 100 } });
      const screen = await render(<ProjectCard project={project} onOpen={noop} />);
      await expect.element(screen.getByText("Untitled")).toBeInTheDocument();
    });

    it("renders 'No audio' for zero-duration projects", async () => {
      const project = makeProject({ metadata: { title: "T", artist: "A", album: "", duration: 0 } });
      const screen = await render(<ProjectCard project={project} onOpen={noop} />);
      await expect.element(screen.getByText("No audio")).toBeInTheDocument();
    });
  });

  describe("rename", () => {
    it("renders an editable input when isRenaming is true", async () => {
      const project = makeProject({
        id: "rn-1",
        metadata: { title: "Editable", artist: "", album: "", duration: 0 },
      });
      const screen = await render(<ProjectCard project={project} onOpen={noop} isRenaming />);
      const input = screen.getByLabelText("Project title").element() as HTMLInputElement;
      expect(input.value).toBe("Editable");
    });

    it("commits the new title on Enter", async () => {
      const project = makeProject({
        id: "rn-2",
        metadata: { title: "Old", artist: "", album: "", duration: 0 },
      });
      const onCommit = vi.fn();
      const screen = await render(<ProjectCard project={project} onOpen={noop} isRenaming onRenameCommit={onCommit} />);
      const input = screen.getByLabelText("Project title").element() as HTMLInputElement;
      input.focus();
      input.setSelectionRange(0, input.value.length);
      await userEvent.keyboard("Brand new{Enter}");
      expect(onCommit).toHaveBeenCalledWith("rn-2", "Brand new");
    });

    it("commits the new title on blur", async () => {
      const project = makeProject({
        id: "rn-3",
        metadata: { title: "Old", artist: "", album: "", duration: 0 },
      });
      const onCommit = vi.fn();
      const screen = await render(<ProjectCard project={project} onOpen={noop} isRenaming onRenameCommit={onCommit} />);
      const input = screen.getByLabelText("Project title").element() as HTMLInputElement;
      input.focus();
      input.setSelectionRange(0, input.value.length);
      await userEvent.keyboard("Via blur");
      input.blur();
      expect(onCommit).toHaveBeenCalledWith("rn-3", "Via blur");
    });

    it("cancels rename on Escape and calls onRenameCancel", async () => {
      const project = makeProject({
        id: "rn-4",
        metadata: { title: "Old", artist: "", album: "", duration: 0 },
      });
      const onCancel = vi.fn();
      const screen = await render(<ProjectCard project={project} onOpen={noop} isRenaming onRenameCancel={onCancel} />);
      const input = screen.getByLabelText("Project title").element() as HTMLInputElement;
      input.focus();
      await userEvent.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledWith("rn-4");
    });

    it("does not call onOpen when the editor input is clicked", async () => {
      const project = makeProject({
        id: "rn-5",
        metadata: { title: "Static", artist: "", album: "", duration: 0 },
      });
      const onOpen = vi.fn();
      const screen = await render(<ProjectCard project={project} onOpen={onOpen} isRenaming />);
      const input = screen.getByLabelText("Project title").element() as HTMLInputElement;
      input.click();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("does not activate onOpen via keyboard while renaming", async () => {
      const project = makeProject({
        id: "rn-6",
        metadata: { title: "Static", artist: "", album: "", duration: 0 },
      });
      const onOpen = vi.fn();
      const screen = await render(<ProjectCard project={project} onOpen={onOpen} isRenaming />);
      const card = screen.getByRole("button", { name: /Static/ }).element() as HTMLElement;
      card.focus();
      await expect.poll(() => document.activeElement).toBe(card);
      await userEvent.keyboard("{Enter}");
      expect(onOpen).not.toHaveBeenCalled();
    });
  });
});
