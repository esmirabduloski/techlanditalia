import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  value?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      id,
      name,
      value,
      className,
      ...props
    },
    ref,
  ) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState(
      defaultChecked ?? false,
    );
    const isOn = isControlled ? checked : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked;
      if (!isControlled) setInternalChecked(next);
      onCheckedChange?.(next);
    };

    return (
      <label
        className={cn(
          "relative inline-block h-[18px] w-[34px] shrink-0 align-middle",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          checked={isOn}
          onChange={handleChange}
          disabled={disabled}
          id={id}
          name={name}
          value={value}
          className="peer sr-only"
          {...props}
        />
        {/* Track */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-full transition-colors",
            isOn ? "bg-primary" : "bg-input",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          )}
        />
        {/* Thumb */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 left-[2px] block h-[14px] w-[14px] -translate-y-1/2 rounded-full bg-white shadow-md transition-transform",
            isOn && "translate-x-[16px]",
          )}
        />
      </label>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
