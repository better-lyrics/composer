import { useModalStackStore } from "@/stores/modal-stack";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { FloatingFocusManager, FloatingPortal, useFloating } from "@floating-ui/react";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

// -- Component ----------------------------------------------------------------

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className, bodyClassName, initialFocusRef }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { refs, context } = useFloating({ open: isOpen, onOpenChange: (open) => !open && onClose() });

  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    const { push, pop } = useModalStackStore.getState();
    push();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      pop();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal returnFocus initialFocus={initialFocusRef}>
        <div
          ref={overlayRef}
          onMouseDown={handleOverlayMouseDown}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <dialog
            ref={refs.setFloating as unknown as React.Ref<HTMLDialogElement>}
            open
            aria-labelledby={title ? "modal-title" : undefined}
            tabIndex={-1}
            className={cn(
              "relative w-full max-w-md mx-4 border shadow-2xl text-composer-text rounded-xl bg-composer-bg-dark border-composer-border focus:outline-none overflow-clip",
              className,
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-composer-border bg-composer-bg-dark sticky top-0 z-10">
                <h2 id="modal-title" className="text-lg font-medium">
                  {title}
                </h2>
                <Button size="icon" variant="ghost" onClick={onClose}>
                  <IconX className="w-5 h-5" />
                </Button>
              </div>
            )}
            <div className={cn(title ? "p-5" : "p-5 pt-4", bodyClassName)}>{children}</div>
          </dialog>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { Modal };
