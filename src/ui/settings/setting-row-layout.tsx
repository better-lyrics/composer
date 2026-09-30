import { cn } from "@/utils/cn";

// -- Component -----------------------------------------------------------------

const SettingRowLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn("flex items-center justify-between gap-8 py-3 [&>:not(:first-child)]:shrink-0", className)}>
    {children}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SettingRowLayout };
