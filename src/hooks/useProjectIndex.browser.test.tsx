import { useProjectIndex } from "@/hooks/useProjectIndex";
import { PROJECT_INDEX_STORE_NAME, PROJECT_RECORD_STORE_NAME, deleteFromStore } from "@/lib/persistence-idb";
import { schedulePendingDeletion } from "@/lib/pending-deletions";
import { PROJECT_CHANNEL_NAME } from "@/lib/project-channel";
import { removeProjectData } from "@/lib/project-repository";
import { render } from "@/test/render";
import { seedStoredProject, songTitled } from "@/test/projects";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

const IndexProbe: React.FC = () => {
  const { entries, error } = useProjectIndex();
  if (error) return <p>failed</p>;
  if (!entries) return <p>loading</p>;
  return (
    <ul aria-label="Index">
      {entries.map((entry) => (
        <li key={entry.id}>{entry.title}</li>
      ))}
    </ul>
  );
};

// -- Tests --------------------------------------------------------------------

describe("useProjectIndex", () => {
  it("lists the stored projects", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await render(<IndexProbe />);
    await expect.element(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("refreshes when a project is saved while it is mounted", async () => {
    const screen = await render(<IndexProbe />);
    await expect.element(screen.getByRole("list", { name: "Index" })).toBeInTheDocument();
    await seedStoredProject("b", { project: songTitled("Bravo") });
    await expect.element(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("refreshes when a project is removed", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    const screen = await render(<IndexProbe />);
    await expect.element(screen.getByText("Alpha")).toBeInTheDocument();
    await removeProjectData("a");
    await expect.element(screen.getByText("Alpha")).not.toBeInTheDocument();
  });

  it("leaves out projects that are pending deletion and brings them back on undo", async () => {
    await seedStoredProject("a", { project: songTitled("Alpha") });
    await seedStoredProject("b", { project: songTitled("Bravo") });
    const screen = await render(<IndexProbe />);
    await expect.element(screen.getByText("Alpha")).toBeInTheDocument();
    const deletion = schedulePendingDeletion(["a"]);
    await expect.element(screen.getByText("Alpha")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Bravo")).toBeInTheDocument();
    deletion.undo();
    await expect.element(screen.getByText("Alpha")).toBeInTheDocument();
  });

  describe("live updates", () => {
    it("refreshes when a project is removed in another tab", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const screen = await render(<IndexProbe />);
      await expect.element(screen.getByText("Alpha")).toBeInTheDocument();
      await deleteFromStore(PROJECT_RECORD_STORE_NAME, "a");
      await deleteFromStore(PROJECT_INDEX_STORE_NAME, "a");
      const otherTab = new BroadcastChannel(PROJECT_CHANNEL_NAME);
      otherTab.postMessage({ type: "projects-deleted", ids: ["a"], sender: "another-tab" });
      otherTab.close();
      await expect.element(screen.getByText("Alpha")).not.toBeInTheDocument();
    });
  });

  describe("regressions", () => {
    it("regression: invalidates the index query once per notify no matter how many hooks are mounted", async () => {
      await seedStoredProject("a", { project: songTitled("Alpha") });
      const TwoProbes: React.FC = () => (
        <>
          <IndexProbe />
          <IndexProbe />
        </>
      );
      const screen = await render(<TwoProbes />);
      await expect.element(screen.getByText("Alpha").first()).toBeInTheDocument();

      let fetches = 0;
      const stop = screen.queryClient.getQueryCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "fetch" && event.query.queryKey[0] === "project-index") {
          fetches += 1;
        }
      });
      await seedStoredProject("b", { project: songTitled("Bravo") });
      await expect.element(screen.getByText("Bravo").first()).toBeInTheDocument();
      stop();
      expect(fetches).toBe(1);
    });
  });
});
