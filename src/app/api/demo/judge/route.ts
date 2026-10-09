import { z } from "zod";
import { defaultRetriever } from "@/lib/agent/defaults";
import { flushTraces } from "@/lib/agent/mask";
import { fakeMode, fakePageJudge } from "@/lib/demo/fake";
import { storedResult } from "@/lib/demo/fallback";
import { labelsOn, readReceipt, writeLabels } from "@/lib/demo/labels";
import { NOTE_MAX, makePageJudge, type PageJudgeFn, type PageJudgment } from "@/lib/demo/pageJudge";
import { resolveItem, type Item } from "@/lib/demo/resolve";
import { readTicket } from "@/lib/demo/tickets";
import { rejectCrossSite } from "@/lib/sameOrigin";
import { encodeEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const verdict = z.enum(["accept", "reject"]);
const schema = z.object({
  token: z.string(),
  items: z
    .array(
      z.object({
        key: z.string(),
        receipt: z.string().optional(),
        visitor: z.object({ verdict, note: z.string().max(NOTE_MAX) }),
      }),
    )
    .min(1)
    .max(8),
});

const g = globalThis as { __pageJudge?: PageJudgeFn };

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid page." }, { status: 400 });
  const { token, items } = parsed.data;
  if (new Set(items.map((i) => i.key)).size !== items.length) return Response.json({ error: "Invalid page." }, { status: 400 });
  const ticket = readTicket(token);
  if (!ticket) return Response.json({ error: "expired" }, { status: 401 });
  // Learner text, question and reference come from the ticket, never from the request.
  const resolved = items.map((i) => resolveItem(ticket, i.key));
  if (resolved.some((r) => r === null)) return Response.json({ error: "That answer is not on this page." }, { status: 400 });
  const first = resolved[0] as Item;
  // The agent's side comes from what the server produced: a valid receipt for
  // this answer, else the stored result it fell back to, else nothing. The
  // browser never supplies it. Only receipted answers are labelled.
  const receipts = items.map((i) => {
    const r = readReceipt(i.receipt);
    return r && r.key === i.key ? r : null;
  });
  const input = {
    question: first.question.prompt,
    reference: first.question.reference,
    passages: first.passages ?? defaultRetriever()(first.question),
    items: items.map((i, n) => {
      const r = receipts[n];
      const s = !r && ticket.kind === "page" ? storedResult(i.key) : null;
      const agent = r
        ? { verdict: r.verdict, note: r.note, certainty: r.certainty, deferred: r.deferred }
        : s
          ? { verdict: s.decision.verdict, note: s.decision.feedback, certainty: s.certainty, deferred: s.decision.action === "defer" }
          : { verdict: null, note: null, certainty: null, deferred: false };
      return { key: i.key, answer: (resolved[n] as Item).answer, visitor: i.visitor, agent };
    }),
  };
  // The judge's call is labelled here, where the judgment was made, never
  // relayed through the browser. A receipt counts only for its own answer.
  const label = async (judgment: PageJudgment) => {
    if (!labelsOn()) return;
    const runs = new Map(receipts.flatMap((r) => (r ? [[r.key, r.runId] as const] : [])));
    await writeLabels(
      judgment.answers.flatMap((a) => (runs.has(a.key) ? [{ runId: runs.get(a.key)!, key: "judge_better_verdict", value: a.better_verdict }] : [])),
    );
  };
  const judge = fakeMode() ? fakePageJudge : (g.__pageJudge ??= makePageJudge());

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
    },
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };
      try {
        const judgment = await judge(input, (partial) => send("partial", { judgment: partial }));
        send("done", { judgment });
        await label(judgment);
      } catch (err) {
        console.error("demo judge failed:", err instanceof Error ? err.message : String(err));
        send("error", { message: "The judge is unavailable right now." });
      }
      await flushTraces();
      if (!closed) controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
