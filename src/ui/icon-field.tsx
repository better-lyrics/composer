import { INPUT_STYLES } from "@/ui/input-styles";
import { cn } from "@/utils/cn";
import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface IconFieldBaseProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: Icon;
  wrapperClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

type IconFieldProps =
  | (IconFieldBaseProps & { trailing: React.ReactNode; placeholder: string })
  | (IconFieldBaseProps & { trailing?: undefined });

// -- Component ----------------------------------------------------------------

const IconField: React.FC<IconFieldProps> = ({
  icon: FieldIcon,
  trailing,
  wrapperClassName,
  className,
  onKeyDown,
  ref,
  type = "text",
  ...inputProps
}) => (
  <div className={cn("relative flex items-center", wrapperClassName)}>
    <FieldIcon
      aria-hidden="true"
      className="absolute left-2.5 size-4 text-composer-text opacity-50 pointer-events-none"
    />
    <input
      ref={ref}
      type={type}
      spellCheck={false}
      autoComplete="off"
      {...inputProps}
      onKeyDown={(event) => {
        const staysLocal = event.key !== "Escape" && !event.metaKey && !event.ctrlKey && !event.altKey;
        if (staysLocal) event.stopPropagation();
        onKeyDown?.(event);
      }}
      className={cn(
        INPUT_STYLES,
        "peer w-full h-8 pl-8 pr-3 rounded-lg hover:border-composer-border-hover placeholder:text-composer-text-muted select-text",
        className,
      )}
    />
    {trailing && (
      <span className="absolute right-2 flex pointer-events-none peer-[:not(:placeholder-shown)]:hidden">
        {trailing}
      </span>
    )}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { IconField };
