import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

const FOCUS_STYLE = `
  .auth-input:focus {
    outline: none;
    border-color: #4F46E5;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
  }
  .auth-input::placeholder { color: #9CA3AF; }
`;

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  error?: boolean;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ leadingIcon, trailingIcon, error, className = "", ...props }, ref) => {
    return (
      <>
        <style>{FOCUS_STYLE}</style>
        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="pointer-events-none absolute left-4 text-[#9CA3AF] flex items-center">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            className={`auth-input w-full bg-white transition-all duration-150 ${
              error
                ? "border-red-400 focus:border-red-500 focus:shadow-none"
                : ""
            } ${className}`}
            style={{
              height: 52,
              borderRadius: 12,
              border: error ? "1.5px #F87171" : "1.5px solid #E5E7EB",
              paddingLeft: leadingIcon ? 44 : 16,
              paddingRight: trailingIcon ? 44 : 16,
              fontSize: 15,
              color: "#0F172A",
            }}
            {...props}
          />
          {trailingIcon && (
            <span className="absolute right-4 flex items-center">{trailingIcon}</span>
          )}
        </div>
      </>
    );
  },
);
AuthInput.displayName = "AuthInput";
