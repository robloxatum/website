"use client";

import { forwardRef, useState } from "react";

/**
 * Five letter boxes backed by ONE real <input> laid over them, so typing,
 * paste, autofill, mobile keyboards and screen readers all behave normally.
 */
export const CodeInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    autoFocus?: boolean;
    invalid?: boolean;
    describedBy?: string;
  }
>(function CodeInput({ value, onChange, disabled, autoFocus, invalid, describedBy }, ref) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, 4);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div aria-hidden="true" className="grid grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: 5 }, (_, i) => {
          const char = value[i] ?? "";
          const isActive = focused && i === active && !disabled;
          return (
            <div
              key={i}
              className={`grid aspect-[4/5] place-items-center rounded-xl border-2 bg-bg-2 font-display text-4xl font-extrabold text-fg transition-[border-color,box-shadow,transform] duration-150 sm:text-5xl ${
                invalid
                  ? "border-bad/70"
                  : isActive
                    ? "border-maize shadow-[0_0_0_4px_rgb(240_196_19/0.2)]"
                    : char
                      ? "border-fg-3/60"
                      : "border-line"
              } ${char ? "animate-pop" : ""}`}
            >
              {char || (isActive ? <span className="h-8 w-0.5 animate-pulse bg-maize" /> : null)}
            </div>
          );
        })}
      </div>
      <input
        ref={ref}
        id="code"
        name="code"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="go"
        maxLength={5}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        // Invisible but real: covers the boxes so tapping any box focuses it.
        className="absolute inset-0 size-full cursor-text rounded-xl bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
    </div>
  );
});
