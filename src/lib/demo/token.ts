import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const mac = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function sign(payload: object, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now })).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function verify<T>(token: string, secret: string, now = Date.now()): T | null {
  const [body, given, extra] = token.split(".");
  if (!body || !given || extra !== undefined) return null;
  const expected = Buffer.from(mac(body, secret));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { iat: number };
    return typeof payload.iat === "number" && now - payload.iat <= TOKEN_TTL_MS ? payload : null;
  } catch {
    return null;
  }
}

let devSecret: string | null = null;

// Serverless instances share nothing, so production needs one configured
// secret; a development server can invent its own.
export function demoSecret(env: Record<string, string | undefined> = process.env): string {
  if (env.GRADERBOT_PAGE_SECRET) return env.GRADERBOT_PAGE_SECRET;
  if (env.NODE_ENV === "production") throw new Error("Set GRADERBOT_PAGE_SECRET: pages cannot be signed without it.");
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}
