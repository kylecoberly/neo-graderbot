import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/trace/[runId] on Vercel", () => {
  afterEach(() => {
    delete process.env.VERCEL;
  });

  it("is not offered: it belongs to the local queue and would reveal the LangSmith org", async () => {
    process.env.VERCEL = "1";
    const res = await GET(new Request("http://localhost/api/trace/r1"), { params: Promise.resolve({ runId: "r1" }) });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });
});
