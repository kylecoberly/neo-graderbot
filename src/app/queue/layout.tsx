import { notFound } from "next/navigation";

// The queue's API is local-only, so on Vercel the page would be an empty shell.
export default function QueueLayout({ children }: { children: React.ReactNode }) {
  if (process.env.VERCEL) notFound();
  return children;
}
