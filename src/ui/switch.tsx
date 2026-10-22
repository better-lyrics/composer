import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const Switch: React.FC<SwitchProps> = ({ checked, onCheckedChange, label, disabled, className }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      "shrink-0 w-9 h-5 p-0.5 rounded-full cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
      checked ? "bg-composer-accent" : "bg-(--layer-3)",
      className,
    )}
  >
    <span
      className={cn(
        "block size-4 rounded-full bg-white transition-[translate] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        checked && "translate-x-4",
      )}
    />
  </button>
);

// -- Exports ------------------------------------------------------------------

export { Switch };
