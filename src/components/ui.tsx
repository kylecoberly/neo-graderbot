import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const VARIANT = {
  primary: "bg-ink text-paper hover:bg-ink/90",
  secondary: "border border-line bg-surface text-ink hover:bg-paper",
} as const;
const BASE = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:hover:bg-ink";

export function Button({ variant = "primary", className = "", ...rest }: ComponentProps<"button"> & { variant?: keyof typeof VARIANT }) {
  return <button type="button" className={`${BASE} ${VARIANT[variant]} ${className}`} {...rest} />;
}

export function LinkButton({ variant = "primary", href, children }: { variant?: keyof typeof VARIANT; href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT[variant]}`}>
      {children}
    </Link>
  );
}

// Prompts, answers and notes are plain text with the occasional fenced code
// block or backticked term; this renders those two things and nothing else.
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(```[\w-]*\n?[\s\S]*?```)/g).filter(Boolean);
  return (
    <div className={`space-y-2 [overflow-wrap:anywhere] ${className}`}>
      {parts.map((part, i) => {
        const fence = /^```[\w-]*\n?([\s\S]*?)```$/.exec(part);
        if (fence) {
          return (
            <pre key={i} className="overflow-x-auto rounded-md bg-ink/[0.045] px-3 py-2 text-[0.85em] leading-relaxed">
              <code>{fence[1].replace(/\n$/, "")}</code>
            </pre>
          );
        }
        const trimmed = part.replace(/^\n+|\n+$/g, "");
        if (!trimmed) return null;
        return (
          <p key={i} className="whitespace-pre-wrap">
            {trimmed.split(/(`[^`\n]+`)/g).map((span, j) =>
              span.startsWith("`") && span.endsWith("`") && span.length > 2 ? (
                <code key={j} className="rounded bg-ink/[0.06] px-1 py-0.5 text-[0.85em]">
                  {span.slice(1, -1)}
                </code>
              ) : (
                span
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

export function VerdictBadge({ verdict, size = "sm" }: { verdict: "accept" | "reject" | null; size?: "sm" | "md" }) {
  const pad = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  if (!verdict) return <span className={`rounded-md bg-ink/[0.06] font-semibold text-muted ${pad}`}>No verdict</span>;
  const tone = verdict === "accept" ? "bg-accept-soft text-accept" : "bg-reject-soft text-reject";
  return <span className={`rounded-md font-semibold ${tone} ${pad}`}>{verdict === "accept" ? "Accept" : "Reject"}</span>;
}
