import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface SelectCheckboxProps {
  label: string;
  checked: boolean;
  onToggle: (range: boolean) => void;
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const CHECKBOX_STYLES = cn(
  "relative appearance-none grid place-items-center size-[18px] rounded-[5px] cursor-pointer",
  "bg-black/35 shadow-[inset_0_0_0_1.5px_#fff] transition-[opacity,background-color,box-shadow] duration-100",
  "checked:bg-composer-accent-dark checked:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25)]",
  "before:content-[''] before:w-[9px] before:h-[5px] before:-mt-0.5 before:border-white before:border-b-2 before:border-l-2",
  "before:-rotate-45 before:scale-0 before:transition-[scale] before:duration-[120ms] checked:before:scale-100",
  "before:ease-emphasized",
  "after:content-[''] after:absolute after:-inset-[11px]",
);

// -- Component ----------------------------------------------------------------

const SelectCheckbox: React.FC<SelectCheckboxProps> = ({ label, checked, onToggle, className }) => (
  <input
    type="checkbox"
    aria-label={label}
    checked={checked}
    onChange={(event) => onToggle(event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey)}
    className={cn(CHECKBOX_STYLES, className)}
  />
);

// -- Exports ------------------------------------------------------------------

export { SelectCheckbox };
