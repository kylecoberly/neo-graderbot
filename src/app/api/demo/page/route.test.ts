import { describe, expect, it } from "vitest";
import { readTicket } from "@/lib/demo/tickets";
import { POST } from "./route";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/demo/page", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });

describe("POST /api/demo/page", () => {
  it("returns a page and a ticket naming exactly its answers", async () => {
    const res = await POST(req({}));
    const page = (await res.json()) as { question: { id: string }; answers: { id: string }[]; token: string };
    const ticket = readTicket(page.token);
    expect(ticket).toEqual(expect.objectContaining({ kind: "page", questionId: page.question.id, answerIds: page.answers.map((a) => a.id) }));
    for (const a of page.answers) expect(Object.keys(a).sort()).toEqual(["answer", "id", "learner"]);
  });
  it("refuses another site", async () => {
    expect((await POST(req({}, { origin: "https://evil.example" }))).status).toBe(403);
  });
  it("refuses an unknown slice", async () => {
    expect((await POST(req({ slice: "cobol" }))).status).toBe(400);
  });
});
