import { describe, expect, it } from "vitest";
import { rejectCrossSite, rejectForeignHost } from "./sameOrigin";

const req = (headers: Record<string, string>) => new Request("http://127.0.0.1:3200/api/queue/review", { method: "POST", headers });

describe("rejectCrossSite", () => {
  it("lets the app's own page through", () => {
    expect(rejectCrossSite(req({ host: "127.0.0.1:3200", origin: "http://127.0.0.1:3200", "sec-fetch-site": "same-origin" }))).toBeNull();
  });
  it("lets a non-browser client through (no Origin, no fetch metadata)", () => {
    expect(rejectCrossSite(req({ host: "127.0.0.1:3200" }))).toBeNull();
  });
  it("refuses another site's page", async () => {
    const res = rejectCrossSite(req({ host: "127.0.0.1:3200", origin: "https://evil.example", "sec-fetch-site": "cross-site" }));
    expect(res?.status).toBe(403);
  });
  it("refuses a mismatched Origin even without fetch metadata", () => {
    expect(rejectCrossSite(req({ host: "127.0.0.1:3200", origin: "http://localhost:9999" }))?.status).toBe(403);
  });
});

describe("rejectForeignHost", () => {
  const at = (host: string, origin?: string) =>
    new Request(`http://${host}/api/queue`, { headers: origin ? { origin, host } : { host } });

  it("serves loopback names", () => {
    for (const h of ["127.0.0.1:3200", "localhost:3200", "[::1]:3200"]) expect(rejectForeignHost(at(h)), h).toBeNull();
  });
  // DNS rebinding: attacker.example resolves to 127.0.0.1, so Origin and Host agree.
  it("refuses a rebound name even when Origin matches Host", () => {
    expect(rejectForeignHost(at("attacker.example:3200", "http://attacker.example:3200"))?.status).toBe(403);
  });
  it("serves a host named in GRADERBOT_ALLOWED_HOSTS", () => {
    expect(rejectForeignHost(at("grader.lan:3200"), { GRADERBOT_ALLOWED_HOSTS: "grader.lan, other.lan" })).toBeNull();
  });
  it("serves the names Vercel gives a deployment, and nothing else", () => {
    const env = {
      VERCEL_URL: "neo-graderbot-abc123.vercel.app",
      VERCEL_BRANCH_URL: "neo-graderbot-git-main.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "neo-graderbot.vercel.app",
    };
    for (const h of Object.values(env)) expect(rejectForeignHost(at(h), env), h).toBeNull();
    expect(rejectForeignHost(at("evil.example"), env)?.status).toBe(403);
  });
  it("is part of the write check", () => {
    expect(rejectCrossSite(at("attacker.example:3200", "http://attacker.example:3200"))?.status).toBe(403);
  });
});
