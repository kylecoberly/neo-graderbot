// The queue has no login. Two attacks follow from that, and both are closed here:
// - a page on another site, open in the same browser, POSTing to the queue
//   (spending model credits, writing fake reviews into LangSmith);
// - DNS rebinding: a hostile name that resolves to 127.0.0.1, which makes
//   Origin and Host agree, so it is the Host itself that must be checked.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostOf(request: Request): string {
  return request.headers.get("host") ?? new URL(request.url).host;
}

// Vercel sets these on every deployment, so the hosted demo needs no
// configuration to accept its own names.
const VERCEL_NAMES = ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"];

export function rejectForeignHost(request: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const name = hostOf(request).replace(/:\d+$/, "").toLowerCase();
  const extra = [...(env.GRADERBOT_ALLOWED_HOSTS ?? "").split(","), ...VERCEL_NAMES.map((k) => env[k] ?? "")]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return LOOPBACK.has(name) || extra.includes(name) ? null : forbidden("Unknown host.");
}

export function rejectCrossSite(request: Request): Response | null {
  const foreign = rejectForeignHost(request);
  if (foreign) return foreign;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return forbidden("Cross-site requests are not allowed.");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== hostOf(request)) return forbidden("Cross-site requests are not allowed.");
  return null;
}

function forbidden(error: string): Response {
  return Response.json({ error }, { status: 403 });
}
