import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// -- Types --------------------------------------------------------------------

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDialogElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      contentRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <dialog
        ref={contentRef}
        open
        aria-labelledby={title ? "modal-title" : undefined}
        className={cn(
          "relative w-full max-w-md mx-4 border shadow-2xl text-composer-text rounded-xl bg-composer-bg-dark border-composer-border focus:outline-none",
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
        <div className={title ? "p-5" : "p-5 pt-4"}>{children}</div>
      </dialog>
    </div>,
    document.body,
  );
};

// -- Exports ------------------------------------------------------------------

export { Modal };
