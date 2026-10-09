"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
// Grows with its text instead of showing a drag handle. `field-sizing` does
// this in CSS where the browser supports it; the effect covers the rest.
export function Textarea({ className = "", value, ...rest }: ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      className={`block w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed [field-sizing:content] placeholder:text-faint focus:border-accent focus:outline-none ${className}`}
      {...rest}
    />
  );
}
