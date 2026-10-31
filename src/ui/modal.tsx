import { useEscapeLayer } from "@/hooks/useEscapeLayer";
import { IconButton } from "@/ui/icon-button";
import { cn } from "@/utils/cn";
import { FloatingFocusManager, FloatingPortal, useFloating } from "@floating-ui/react";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerAccessory?: React.ReactNode;
  headerActions?: React.ReactNode;
  animateIn?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
  describedById?: string;
}

// -- Constants ----------------------------------------------------------------

const MODAL_EXIT_FALLBACK_MS = 300;

// -- Component ----------------------------------------------------------------

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  headerAccessory,
  headerActions,
  animateIn = true,
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

  // Frozen when the modal opens or closes, so a later change never restarts an animation.
  const [phase, setPhase] = useState({ isOpen, handoff: !animateIn, leaving: false });
  if (phase.isOpen !== isOpen) setPhase({ isOpen, handoff: !animateIn, leaving: !isOpen && animateIn });
  const finishLeaving = useCallback(() => setPhase((current) => ({ ...current, leaving: false })), []);

  useEffect(() => {
    if (!phase.leaving) return;
    const fallback = window.setTimeout(finishLeaving, MODAL_EXIT_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [phase.leaving, finishLeaving]);

  if (!isOpen && !phase.leaving) return null;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal returnFocus initialFocus={initialFocusRef}>
        <div
          ref={overlayRef}
          role="presentation"
          onMouseDown={handleOverlayMouseDown}
          data-handoff={isOpen && phase.handoff ? "" : undefined}
          data-leaving={phase.leaving ? "" : undefined}
          inert={phase.leaving}
          className="fixed inset-0 layer-floating flex items-center justify-center modal-scrim"
        >
          <dialog
            ref={refs.setFloating as unknown as React.Ref<HTMLDialogElement>}
            onAnimationEnd={(e) => {
              if (phase.leaving && e.target === e.currentTarget) finishLeaving();
            }}
            open
            role={role}
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={describedById}
            tabIndex={-1}
            className={cn(
              "relative w-full max-w-md mx-4 text-composer-text rounded-2xl surface-modal focus:outline-none overflow-clip",
              className,
            )}
          >
            {title && (
              <div className="flex items-center gap-3 h-14 pl-5 pr-2.5 border-b border-(--divider) bg-(--pop) sticky top-0 z-10">
                <h2 id={titleId} title={title} className="min-w-0 truncate text-base font-bold">
                  {title}
                </h2>
                {headerAccessory}
                <div className="ml-auto flex items-center gap-1">
                  {headerActions}
                  <IconButton
                    label="Close"
                    icon={<IconX className="size-[18px]" />}
                    variant="ghost"
                    onClick={onClose}
                    className="size-9 rounded-[10px]"
                  />
                </div>
              </div>
            )}
            <div id={describedById} className={cn(title ? "pt-[18px] px-5 pb-5" : "p-5 pt-4", bodyClassName)}>
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
