import { PopButton } from "@/ui/pop-layout";
import { StemNotice } from "@/ui/stem-sources/stem-notice";

// -- Interfaces ----------------------------------------------------------------

interface ModelErrorNoticeProps {
  title: string;
  next: string;
  message: string;
  onDismiss: () => void;
  onRetry: () => void;
  className?: string;
}

// -- Components ----------------------------------------------------------------

// A failed model download or run: what went wrong, what to do, and the raw error to copy.
const ModelErrorNotice: React.FC<ModelErrorNoticeProps> = ({ title, next, message, onDismiss, onRetry, className }) => (
  <StemNotice
    tone="negative"
    className={className}
    actions={
      <>
        <PopButton variant="ghost" onClick={onDismiss}>
          Dismiss
        </PopButton>
        <PopButton variant="primary" onClick={onRetry}>
          Try again
        </PopButton>
      </>
    }
  >
    <p className="text-[13px] font-medium leading-[1.35] text-composer-text text-pretty">{title}</p>
    <p className="mt-0.5 text-xs leading-[1.45] text-(--label) text-pretty">{next}</p>
    <p className="mt-1.5 text-xs leading-[1.45] text-(--muted) wrap-break-word select-text cursor-text">{message}</p>
  </StemNotice>
);

// -- Exports -------------------------------------------------------------------

export { ModelErrorNotice };
