import { grade } from "@/lib/agent/run";
import { queueGraph } from "@/lib/queue/graph";
import { applyOutcome, markFailed, queueStats, type QueueState } from "@/lib/queue/state";
import { queueStore, reserve } from "@/lib/queue/store";
import { localOnly } from "@/lib/localOnly";
import { rejectCrossSite } from "@/lib/sameOrigin";
import { encodeEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const hidden = localOnly();
  if (hidden) return hidden;
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const store = queueStore();
  const reserved = await reserve(store);
  if (!reserved) return new Response(null, { status: 204 });
  const { row, question } = reserved;
  const encoder = new TextEncoder();

  // The browser may leave mid-grade (a reload); grading still finishes and is
  // saved, it just stops being streamed.
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
    },
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };
      const finish = (state: QueueState) =>
        send("done", { row: state.rows.find((r) => r.answerId === row.answerId), stats: queueStats(state) });
      send("row", row);
      try {
        const outcome = await grade(queueGraph(), { answerId: row.answerId, question, answer: row.answer }, {
          onFeedback: (text) => send("feedback", { answerId: row.answerId, text }),
        });
        finish(await store.update((s) => applyOutcome(s, row.answerId, outcome)));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        finish(await store.update((s) => markFailed(s, row.answerId, message)));
      }
      if (!closed) controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
