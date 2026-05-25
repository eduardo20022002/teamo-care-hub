import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  error?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ leadingIcon, trailingIcon, error, className = "", ...props }, ref) => {
    const inputClass = [
      "auth-input",
      error ? "error" : "",
      leadingIcon ? "with-leading" : "",
      trailingIcon ? "with-trailing" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-4 text-muted-foreground flex items-center">
            {leadingIcon}
          </span>
        )}
        <input ref={ref} className={inputClass} {...props} />
        {trailingIcon && (
          <span className="absolute right-4 flex items-center">{trailingIcon}</span>
        )}
      </div>
    );
  },
);
AuthInput.displayName = "AuthInput";
