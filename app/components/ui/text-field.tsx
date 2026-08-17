import * as React from "react";

import { cn } from "~/lib/utils";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, id, label, error, hint, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const descriptionId = `${inputId}-description`;

    return (
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? descriptionId : undefined}
          className={cn(
            "min-h-12 w-full rounded-2xl border bg-card px-4 text-base text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25",
            error && "border-secondary",
            className,
          )}
          {...props}
        />
        {error || hint ? (
          <p
            id={descriptionId}
            className={cn(
              "mt-2 text-sm",
              error ? "font-semibold text-secondary" : "text-muted-foreground",
            )}
          >
            {error ?? hint}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";
