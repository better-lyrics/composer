import { useRef, useState } from "react";
import { useConfirmStore } from "@/stores/confirm-store";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Modal } from "@/ui/modal";
import { cn } from "@/utils/cn";
import { UndoHint } from "@/ui/undo-hint";

// -- Component ----------------------------------------------------------------

const ConfirmModalHost: React.FC = () => {
  const isOpen = useConfirmStore((s) => s.isOpen);
  const options = useConfirmStore((s) => s.options);
  const resolveAndClose = useConfirmStore((s) => s.resolveAndClose);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    resolveAndClose(false, false);
    setDontAskAgain(false);
  };

  const handleConfirm = () => {
    resolveAndClose(true, dontAskAgain);
    setDontAskAgain(false);
  };

  if (!isOpen || !options) return null;

  const {
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "destructive",
    settingsKey,
    recoverable = false,
  } = options;

  const showDontAskAgain = Boolean(settingsKey);

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title={title}
      className="max-w-md"
      initialFocusRef={variant === "destructive" ? cancelButtonRef : confirmButtonRef}
    >
      <div className="flex flex-col gap-3">
        {description && (
          <div className="text-sm text-(--label) leading-normal text-pretty wrap-break-word select-text">
            {description}
          </div>
        )}
        {recoverable && <UndoHint />}

        <div className={cn("flex items-center pt-2", showDontAskAgain ? "justify-between" : "justify-end")}>
          {showDontAskAgain && (
            <Checkbox checked={dontAskAgain} onCheckedChange={setDontAskAgain}>
              Don't ask again
            </Checkbox>
          )}
          <div className="flex gap-2 select-none">
            <Button ref={cancelButtonRef} variant="secondary" size="lg" onClick={handleClose}>
              {cancelLabel}
            </Button>
            <Button ref={confirmButtonRef} size="lg" variant={variant} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { ConfirmModalHost };
