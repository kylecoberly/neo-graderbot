// The instructor queue keeps its state in a JSON file. Vercel's filesystem
// does not survive between requests, so the deployed demo does not offer it.
export function localOnly(env: Record<string, string | undefined> = process.env): Response | null {
  return env.VERCEL ? new Response(null, { status: 404 }) : null;
}
