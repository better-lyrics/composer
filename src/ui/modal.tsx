import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import { FloatingFocusManager, FloatingPortal, useFloating } from "@floating-ui/react";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useId, useRef } from "react";

// -- Types --------------------------------------------------------------------

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerAccessory?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
  describedById?: string;
}

// -- Component ----------------------------------------------------------------

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  headerAccessory,
  children,
  className,
  bodyClassName,
  initialFocusRef,
  role = "dialog",
  describedById,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { refs, context } = useFloating({ open: isOpen, onOpenChange: (open) => !open && onClose() });

  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  useEscapeLayer("modal", isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal returnFocus initialFocus={initialFocusRef}>
        <div
          ref={overlayRef}
          role="presentation"
          onMouseDown={handleOverlayMouseDown}
          className="fixed inset-0 layer-floating flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <dialog
            ref={refs.setFloating as unknown as React.Ref<HTMLDialogElement>}
            open
            role={role}
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={describedById}
            tabIndex={-1}
            className={cn(
              "relative w-full max-w-md mx-4 border shadow-2xl text-composer-text rounded-xl bg-composer-bg-dark border-composer-border focus:outline-none overflow-clip",
              className,
            )}
          >
            {title && (
              <div className="flex items-center px-5 py-4 border-b border-composer-border bg-composer-bg-dark sticky top-0 z-10">
                <h2 id={titleId} className="text-lg font-medium">
                  {title}
                </h2>
                {headerAccessory}
                <IconButton
                  label="Close"
                  icon={<IconX className="size-5" />}
                  variant="ghost"
                  onClick={onClose}
                  className="ml-auto"
                />
              </div>
            )}
            <div id={describedById} className={cn(title ? "p-5" : "p-5 pt-4", bodyClassName)}>
              {children}
            </div>
          </dialog>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
};

// -- Exports ------------------------------------------------------------------

export { Modal };
