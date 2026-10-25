import { DesignSection } from "@/pages/design/design-section";
import { StateCell } from "@/pages/design/state-cell";
import { type StateChip, StateChips } from "@/pages/design/state-chips";
import { Button } from "@/ui/button";
import { toast, useSonner } from "sonner";

// -- Types ---------------------------------------------------------------------

type ToastStackState = "empty" | "one" | "stacked";

// -- Functions -----------------------------------------------------------------

function showOpenedToast(): void {
  toast(`Opened "Midnight City" in a new project`, { description: `"Starlight" is still in Projects.` });
}

function showImportedToast(): void {
  toast.success("Imported 42 lines");
}

function showErrorToast(): void {
  toast.error("Couldn't switch back to that project");
}

function showDeletedToast(): void {
  toast(`Deleted "Midnight City"`, {
    closeButton: true,
    action: { label: "Undo", onClick: () => toast(`Restored "Midnight City"`) },
  });
}

function showStack(): void {
  showOpenedToast();
  showImportedToast();
  showDeletedToast();
}

function stackState(count: number): ToastStackState {
  if (count === 0) return "empty";
  return count === 1 ? "one" : "stacked";
}

// -- Constants -----------------------------------------------------------------

const STATES: readonly StateChip<ToastStackState>[] = [
  { id: "empty", label: "Empty", enter: () => toast.dismiss() },
  { id: "one", label: "One toast", hint: "Show any toast below." },
  { id: "stacked", label: "Stacked", enter: showStack },
];

// -- Components ----------------------------------------------------------------

const ToastStackDemo: React.FC = () => {
  const { toasts } = useSonner();

  return (
    <DesignSection
      id="toasts"
      note="Toasts confirm what just happened, at the bottom of the screen. The newest sits in front, and the stack fans out on hover. A toast with an action, such as Undo, gets a close button so you can dismiss it yourself."
    >
      <StateChips label="Toast stack states" states={STATES} current={stackState(toasts.length)} />
      <StateCell label="Toasts appear at the bottom of the page">
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={showOpenedToast}>
            Plain
          </Button>
          <Button size="sm" variant="secondary" onClick={showImportedToast}>
            Success
          </Button>
          <Button size="sm" variant="secondary" onClick={showErrorToast}>
            Error
          </Button>
          <Button size="sm" variant="secondary" onClick={showDeletedToast}>
            With Undo
          </Button>
        </div>
      </StateCell>
    </DesignSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { ToastStackDemo };
