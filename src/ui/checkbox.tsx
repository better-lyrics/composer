import { cn } from "@/utils/cn";
import { IconCheck } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

// -- Component ----------------------------------------------------------------

const Checkbox: React.FC<CheckboxProps> = ({ checked, onCheckedChange, children, disabled, className }) => (
  <label
    className={cn(
      "inline-flex items-center gap-2 text-[13px] text-(--muted) select-none cursor-pointer transition-colors hover:text-(--label) rounded-md has-[:focus-visible]:text-(--label) has-[:focus-visible]:bg-(--focus-tint)",
      "has-disabled:opacity-50 has-disabled:cursor-not-allowed has-disabled:hover:text-(--muted)",
      className,
    )}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className="peer sr-only"
    />
    <span
      aria-hidden="true"
      className="grid place-items-center size-4 shrink-0 forced-colors:peer-focus-visible:outline-2 forced-colors:peer-focus-visible:outline-offset-2 rounded-[5px] bg-(--well) shadow-(--well-edge) text-transparent transition-colors peer-checked:bg-composer-accent peer-checked:shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] peer-checked:text-composer-on-accent"
    >
      <IconCheck className="size-3" stroke={2} />
    </span>
    {children}
  </label>
);

// -- Exports ------------------------------------------------------------------

export { Checkbox };
