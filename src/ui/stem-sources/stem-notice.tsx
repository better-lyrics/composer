import { cn } from "@/utils/cn";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface StemNoticeProps {
  tone: "warning" | "negative";
  children: React.ReactNode;
  actions: React.ReactNode;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const TONES = {
  warning: { surface: "bg-composer-warning/9", icon: "text-composer-warning", Icon: IconAlertTriangle },
  negative: { surface: "bg-composer-negative/9", icon: "text-composer-negative", Icon: IconAlertCircle },
};

// -- Component ----------------------------------------------------------------

const StemNotice: React.FC<StemNoticeProps> = ({ tone, children, actions, className }) => {
  const { surface, icon, Icon } = TONES[tone];
  return (
    <div role="alert" className={cn("relative p-2.5 pl-8.5 rounded-md", surface, className)}>
      <Icon aria-hidden="true" className={cn("absolute left-2 top-2.5 size-4", icon)} />
      {children}
      <div className="flex justify-end gap-1.5 mt-2.5">{actions}</div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemNotice };
