import { describe, expect, it } from "vitest";
import { localOnly } from "./localOnly";

describe("localOnly", () => {
  it("answers 404 on Vercel", () => {
    expect(localOnly({ VERCEL: "1" })?.status).toBe(404);
  });
  it("lets the request through locally", () => {
    expect(localOnly({})).toBeNull();
  });
});
