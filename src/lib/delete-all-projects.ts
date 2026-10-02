import { closeAndClearAllProjects } from "@/lib/open-project";
import { commitAllPendingDeletions } from "@/lib/pending-deletions";

// -- Deleting -----------------------------------------------------------------

async function deleteAllProjects(): Promise<void> {
  await commitAllPendingDeletions();
  await closeAndClearAllProjects();
}

// -- Exports ------------------------------------------------------------------

export { deleteAllProjects };
