import { saveProjectRecord } from "@/lib/project-repository";
import { RecoverPanel } from "@/pages/recover";
import { captureDownloads } from "@/test/downloads";
import { seedProject } from "@/test/idb";
import { songTitled, storedProject } from "@/test/projects";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";

describe("RecoverPanel", () => {
  it("shows the empty-state message when IndexedDB has no project", async () => {
    const screen = await render(<RecoverPanel />);
    await expect.element(screen.getByText(/Nothing saved in this browser yet/)).toBeInTheDocument();
  });

  it("hides the Download button when there is nothing to recover", async () => {
    const screen = await render(<RecoverPanel />);
    await expect.element(screen.getByText(/Nothing saved in this browser yet/)).toBeInTheDocument();
    const buttons = Array.from(screen.container.querySelectorAll("button")).map((b) => b.textContent?.trim() ?? "");
    expect(buttons.some((t) => /Download/.test(t))).toBe(false);
    expect(buttons.some((t) => /Back to Composer/.test(t))).toBe(true);
  });

  it("auto-downloads and shows project metadata when a project is present", async () => {
    await seedProject({
      version: 1,
      savedAt: 1715000000000,
      metadata: { title: "AutoSong" },
      lines: [
        { id: "a", text: "x", agentId: "v1" },
        { id: "b", text: "y", agentId: "v1" },
        { id: "c", text: "z", agentId: "v1" },
      ],
    });

    let captured: string | null = null;
    const originalCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreate(tag);
      if (tag.toLowerCase() === "a") {
        const anchor = el as HTMLAnchorElement;
        const click = anchor.click.bind(anchor);
        anchor.click = () => {
          captured = anchor.download;
          click();
        };
      }
      return el;
      // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
    }) as any;

    try {
      const screen = await render(<RecoverPanel />);
      await expect.element(screen.getByText(/AutoSong-/)).toBeInTheDocument();
      await expect.element(screen.getByText(/3 lines/)).toBeInTheDocument();
      expect(captured).toMatch(/^AutoSong-/);
    } finally {
      document.createElement = originalCreate;
    }
  });

  it("offers a Download again button after the auto-download succeeds", async () => {
    await seedProject({ version: 1, metadata: { title: "Again" }, lines: [{ id: "a", text: "x", agentId: "v1" }] });
    const originalCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      const el = originalCreate(tag);
      if (tag.toLowerCase() === "a") {
        const anchor = el as HTMLAnchorElement;
        anchor.click = () => {};
      }
      return el;
      // biome-ignore lint/suspicious/noExplicitAny: monkey-patch for capture
    }) as any;
    try {
      const screen = await render(<RecoverPanel />);
      await expect.element(screen.getByRole("button", { name: /Download again/ })).toBeInTheDocument();
    } finally {
      document.createElement = originalCreate;
    }
  });

  it("lists every project below the automatic download when there are several", async () => {
    await saveProjectRecord("a", storedProject(songTitled("Alpha")));
    await saveProjectRecord("b", storedProject(songTitled("Bravo")));
    const downloads = captureDownloads();
    const screen = await render(<RecoverPanel />);
    await expect.element(screen.getByRole("heading", { name: "Every project on this device" })).toBeInTheDocument();
    downloads.stop();
  });

  it("regression: says 1 line, not 1 lines, for a one-line project", async () => {
    await seedProject({ version: 1, metadata: { title: "Solo" }, lines: [{ id: "a", text: "x", agentId: "v1" }] });
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {};
    try {
      const screen = await render(<RecoverPanel />);
      await expect.element(screen.getByText(/^1 line, last edited/)).toBeInTheDocument();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});
