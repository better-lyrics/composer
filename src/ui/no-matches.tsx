import { IconZoomQuestion } from "@tabler/icons-react";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface NoMatchesProps {
  message: string;
  hint?: string;
  action?: React.ReactNode;
  size?: "default" | "large";
}

// -- Constants -----------------------------------------------------------------

const SIZES = {
  default: { icon: 22, iconGap: "mb-2", message: "text-xs", hint: "text-[11px] mt-0.5" },
  large: { icon: 28, iconGap: "mb-2.5", message: "text-sm", hint: "text-xs mt-1" },
} as const;

// -- Components ----------------------------------------------------------------

const NoMatches: React.FC<NoMatchesProps> = ({ message, hint, action, size = "default" }) => {
  const styles = SIZES[size];
  return (
    <output className="m-auto flex flex-col items-center px-4 text-center">
      <IconZoomQuestion
        size={styles.icon}
        className={cn("text-composer-text opacity-25", styles.iconGap)}
        aria-hidden="true"
      />
      <span className={cn("font-medium text-composer-text-secondary select-text", styles.message)}>{message}</span>
      {hint && <span className={cn("text-composer-text-muted", styles.hint)}>{hint}</span>}
      {action && <div className="mt-3">{action}</div>}
    </output>
  );
};

// -- Exports -------------------------------------------------------------------

export { NoMatches };
