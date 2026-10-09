import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-baseline gap-6 px-6 py-3">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          Neo GraderBot
        </Link>
        <Link href="/grade" className="text-sm text-muted hover:text-ink">
          Grade a page
        </Link>
        <Link href="/try" className="text-sm text-muted hover:text-ink">
          Try your own
        </Link>
        <a href="https://github.com/kylecoberly/neo-graderbot" className="ml-auto text-sm text-muted hover:text-ink">
          Source &amp; evals
        </a>
      </div>
    </nav>
  );
}
