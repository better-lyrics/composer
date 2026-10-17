import { adoptOpenProjectId, forgetOpenProjectId } from "@/lib/open-project-session";
import { setSavePending, trackSave } from "@/lib/save-status";
import { render } from "@/test/render";
import { SaveStatusLabel } from "@/ui/projects/save-status-label";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function failOneWrite(): Promise<void> {
  return trackSave("project", Promise.reject(new Error("quota"))).catch(() => undefined);
}

function succeedOneWrite(): Promise<void> {
  return trackSave("project", Promise.resolve());
}

// -- Tests --------------------------------------------------------------------

describe("SaveStatusLabel", () => {
  it("says Saved for an open project with nothing pending", async () => {
    adoptOpenProjectId("p1");
    const screen = await render(<SaveStatusLabel />);
    await expect.element(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("says Saving while a save is pending, then Saved", async () => {
    adoptOpenProjectId("p1");
    const screen = await render(<SaveStatusLabel />);
    setSavePending(true);
    await expect.element(screen.getByText("Saving")).toBeInTheDocument();
    setSavePending(false);
    await expect.element(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("says Not saved after a failed write", async () => {
    adoptOpenProjectId("p1");
    const screen = await render(<SaveStatusLabel />);
    await failOneWrite();
    await expect.element(screen.getByText("Not saved", { exact: true }).first()).toBeInTheDocument();
  });

  describe("announcements", () => {
    it("announces a failed save", async () => {
      adoptOpenProjectId("p1");
      const screen = await render(<SaveStatusLabel />);
      await failOneWrite();
      await expect.element(screen.getByRole("status")).toHaveTextContent("Not saved");
    });

    it("announces Saved once a failed save recovers", async () => {
      adoptOpenProjectId("p1");
      const screen = await render(<SaveStatusLabel />);
      await failOneWrite();
      await expect.element(screen.getByRole("status")).toHaveTextContent("Not saved");
      await succeedOneWrite();
      await expect.element(screen.getByRole("status")).toHaveTextContent("Saved");
    });

    it("stays silent through an ordinary save burst", async () => {
      adoptOpenProjectId("p1");
      const screen = await render(<SaveStatusLabel />);
      setSavePending(true);
      await expect.element(screen.getByText("Saving")).toBeInTheDocument();
      expect(screen.getByRole("status").element().textContent).toBe("");
      setSavePending(false);
      await expect.element(screen.getByText("Saved")).toBeInTheDocument();
      expect(screen.getByRole("status").element().textContent).toBe("");
    });

    it("does not announce Saving while a failed save retries", async () => {
      adoptOpenProjectId("p1");
      const screen = await render(<SaveStatusLabel />);
      await failOneWrite();
      setSavePending(true);
      await expect.element(screen.getByText("Saving")).toBeInTheDocument();
      expect(screen.getByRole("status").element().textContent).toBe("Not saved");
    });
  });

  describe("edge cases", () => {
    it("keeps an empty live region but no label before the project has an id", async () => {
      forgetOpenProjectId();
      const screen = await render(<SaveStatusLabel />);
      expect(screen.getByRole("status").element().textContent).toBe("");
      expect(screen.container.textContent).toBe("");
    });

    it("the label appears once the project gets an id", async () => {
      const screen = await render(<SaveStatusLabel />);
      adoptOpenProjectId("p1");
      await expect.element(screen.getByText("Saved")).toBeInTheDocument();
    });
  });
});
