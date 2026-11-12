import { cn } from "@/utils/cn";

// -- Constants -----------------------------------------------------------------

const SETTING_ROW_SURFACE =
  "-mx-2.5 px-2.5 rounded-[10px] transition-colors has-[:not(input,textarea):focus-visible]:bg-(--focus-tint)";

// -- Component -----------------------------------------------------------------

const SettingRowLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      SETTING_ROW_SURFACE,
      "flex items-center justify-between gap-6 py-3.5 [&>:not(:first-child)]:shrink-0",
      className,
    )}
  >
    {children}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SETTING_ROW_SURFACE, SettingRowLayout };
