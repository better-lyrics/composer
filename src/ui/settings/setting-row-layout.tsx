import { cn } from "@/utils/cn";

// -- Component -----------------------------------------------------------------

const SettingRowLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      "flex items-center justify-between gap-6 py-3.5 -mx-2.5 px-2.5 rounded-[10px] transition-colors has-[:not(input,textarea):focus-visible]:bg-(--focus-tint) [&>:not(:first-child)]:shrink-0",
      className,
    )}
  >
    {children}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SettingRowLayout };
