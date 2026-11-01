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
      "group shrink-0 w-[30px] h-5 p-0.5 rounded-[7px] cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
      checked ? "bg-composer-accent shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)]" : "bg-(--well) shadow-(--well-edge)",
      className,
    )}
  >
    <span
      className={cn(
        "flex items-center justify-center gap-0.5 w-3.5 h-4 rounded-[5px] bg-linear-to-b from-white to-[color-mix(in_oklab,white_86%,var(--color-composer-bg))] shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_0_0_0.5px_rgb(0_0_0/0.12)] transition-[translate,scale] duration-[220ms,120ms] ease-[cubic-bezier(0.34,1.45,0.64,1)] group-active:scale-[0.88] group-disabled:group-active:scale-100",
        checked && "translate-x-3",
      )}
    >
      <i className="block w-px h-2 rounded-[1px] bg-[color-mix(in_oklab,black_38%,transparent)]" />
      <i className="block w-px h-2 rounded-[1px] bg-[color-mix(in_oklab,black_38%,transparent)]" />
    </span>
  </button>
);

// -- Exports ------------------------------------------------------------------

export { Switch };
