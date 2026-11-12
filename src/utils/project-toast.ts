import { IconTrash } from "@tabler/icons-react";
import { createElement } from "react";
import { quotedTitle } from "@/domain/project/display-title";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { deleteProject, forkOpenProject, openProject } from "@/lib/open-project";
import { openProjectIdSnapshot, subscribeOpenProjectId } from "@/lib/open-project-session";
import type { PendingDeletion } from "@/lib/pending-deletions";
import { NewerProjectError } from "@/lib/saved-project";
import { useProjectStore } from "@/stores/project";
import { formatProjectCount } from "@/utils/project-count";
import { toast } from "@/utils/toast";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[ProjectToast]";

// -- Switching back -----------------------------------------------------------

function abandonedNewProjectId(newId: string): string | undefined {
  if (openProjectIdSnapshot() !== newId) return undefined;
  return hasLyricLines(useProjectStore.getState().lines) ? undefined : newId;
}

async function switchBackToPreviousProject(previousId: string, newId: string): Promise<void> {
  const abandonedId = abandonedNewProjectId(newId);
  try {
    await openProject(previousId);
  } catch (error) {
    console.error(LOG_PREFIX, "could not switch back", error);
    toast.error("Couldn't switch back to that project");
    return;
  }
  if (!abandonedId) return;
  deleteProject(abandonedId).catch((error: unknown) => {
    console.error(LOG_PREFIX, "could not delete the abandoned project", error);
  });
}

// -- Toasts -------------------------------------------------------------------

function showSwitchBackToast(message: string, description: string, previousId: string, newId: string): void {
  toast(message, {
    description,
    action: {
      label: "Switch back",
      onClick: () => {
        void switchBackToPreviousProject(previousId, newId);
      },
    },
  });
}

function showNewProjectToast(title: string, previousTitle: string, previousId: string, newId: string): void {
  showSwitchBackToast(
    `Opened ${quotedTitle(title)} in a new project`,
    `${quotedTitle(previousTitle)} is still in Projects.`,
    previousId,
    newId,
  );
}

function showLinkedProjectToast(title: string, previousTitle: string, previousId: string, newId: string): void {
  showSwitchBackToast(
    `Opened ${quotedTitle(title)} from Better Lyrics`,
    `New project. ${quotedTitle(previousTitle)} is still in Projects.`,
    previousId,
    newId,
  );
}

// -- Newer saves --------------------------------------------------------------

function showNeedsNewerComposerToast(message: string, description: string): void {
  toast.error(message, {
    description,
    closeButton: true,
    action: { label: "Reload", onClick: () => window.location.reload() },
  });
}

function showNewerProjectToast(): void {
  showNeedsNewerComposerToast(
    "This project needs a newer Composer",
    "It was saved by a newer version. Reload to update, then open it again.",
  );
}

function showNewerLinkToast(): void {
  showNeedsNewerComposerToast("This link needs a newer Composer", "Reload to update and open it.");
}

function keepChangesAsNewProject(projectId: string): void {
  if (openProjectIdSnapshot() !== projectId) return;
  forkOpenProject().catch((error: unknown) => {
    console.error(LOG_PREFIX, "could not keep the changes as a new project", error);
    toast.error("Couldn't save your changes as a new project");
  });
}

function showNewerSaveRefusedToast(projectId: string): void {
  const toastId = toast.error("A newer Composer saved this project in another tab", {
    description: "Your changes here can't be saved over it. Keep them as a new project, or reload to update.",
    closeButton: true,
    action: { label: "Keep as new project", onClick: () => keepChangesAsNewProject(projectId) },
  });
  const stopWatching = subscribeOpenProjectId(() => {
    if (openProjectIdSnapshot() === projectId) return;
    toast.dismiss(toastId);
    stopWatching();
  });
}

function reportOpenProjectFailure(error: unknown): void {
  console.error(LOG_PREFIX, "could not open the project", error);
  if (error instanceof NewerProjectError) showNewerProjectToast();
  else toast.error("Couldn't open that project");
}

// -- Deleting -----------------------------------------------------------------

function deletedMessage(titles: readonly string[]): string {
  return titles.length === 1
    ? `Deleted ${quotedTitle(titles[0] ?? "")}`
    : `Deleted ${formatProjectCount(titles.length)}`;
}

function showDeletedProjectsToast(titles: readonly string[], deletion: PendingDeletion): void {
  const commit = () => {
    deletion.commit().catch((error: unknown) => {
      console.error(LOG_PREFIX, "could not delete the projects", error);
      toast.error(titles.length === 1 ? "Couldn't delete that project" : "Couldn't delete some projects");
    });
  };
  toast(deletedMessage(titles), {
    icon: createElement(IconTrash, { "aria-hidden": true, className: "size-[18px] text-composer-text opacity-60" }),
    closeButton: true,
    action: { label: "Undo", onClick: () => deletion.undo() },
    onAutoClose: commit,
    onDismiss: commit,
  });
}

// -- Exports ------------------------------------------------------------------

export {
  showNewProjectToast,
  showLinkedProjectToast,
  showDeletedProjectsToast,
  showNewerProjectToast,
  showNewerLinkToast,
  showNewerSaveRefusedToast,
  reportOpenProjectFailure,
};
