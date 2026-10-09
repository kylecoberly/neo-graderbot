import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.GRADERBOT_FAKE_MODEL = "1";
});

import { readTicket, type CustomTicket } from "@/lib/demo/tickets";
import { parseEvents } from "@/lib/sse";
import { POST } from "./route";

const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/try/generate", { method: "POST", body: JSON.stringify(body), headers }));

describe("POST /api/try/generate", () => {
  it("returns a signed exercise of 8 planned responses", async () => {
    const { events } = parseEvents(await (await call({ question: "What does the cd command do?" })).text());
    const done = events.at(-1)!;
    expect(done.event).toBe("done");
    const data = done.data as { token: string; entries: { key: string; learner: null; kind: string; intended: string }[]; question: { vocabulary: string[] } };
    const ticket = readTicket(data.token) as CustomTicket;
    expect(ticket.kind).toBe("custom");
    expect(ticket.bundle.responses).toHaveLength(8);
    const rejects = ticket.bundle.responses.filter((r) => r.intended === "reject").length;
    expect(rejects).toBeGreaterThanOrEqual(3);
    expect(rejects).toBeLessThanOrEqual(5);
    expect(data.entries.map((e) => e.key)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
    expect(data.entries[0]).toMatchObject({ learner: null, kind: expect.any(String), intended: expect.any(String) });
    expect(data.question.vocabulary.length).toBeGreaterThan(0);
  });

  it("passes the generator's reason when the question doesn't fit", async () => {
    const { events } = parseEvents(await (await call({ question: "Which editor is best for beginners?" })).text());
    expect(events.at(-1)).toEqual({ event: "unfit", data: { reason: "Fake: that asks for an opinion." } });
  });

  it("refuses a question the guard turns away, before any model call", async () => {
    const res = await call({ question: "Why?" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/full question/);
    expect((await call({ question: 5 })).status).toBe(400);
  });

  it("refuses another site", async () => {
    expect((await call({ question: "What does the cd command do?" }, { origin: "https://evil.example" })).status).toBe(403);
  });
});
