import { z } from "zod";
import { appendOverride } from "@/lib/queue/overrides";
import { applyReview, queueStats } from "@/lib/queue/state";
import { queueStore } from "@/lib/queue/store";
import { localOnly } from "@/lib/localOnly";
import { rejectCrossSite } from "@/lib/sameOrigin";

export const dynamic = "force-dynamic";

const body = z.object({ answerId: z.string(), verdict: z.enum(["accept", "reject"]), feedback: z.string().min(1) });

export async function POST(request: Request) {
  const hidden = localOnly();
  if (hidden) return hidden;
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send answerId, verdict (accept|reject) and feedback." }, { status: 400 });
  const { answerId, verdict, feedback } = parsed.data;
  const store = queueStore();
  const row = (await store.read()).rows.find((r) => r.answerId === answerId);
  if (!row || row.status === "grading") return Response.json({ error: "No reviewable row with that id." }, { status: 404 });
  // A second tab or a retried request would otherwise append a duplicate
  // example to neo-graderbot-overrides and overwrite the first review.
  if (row.review) return Response.json({ error: "That answer has already been reviewed." }, { status: 409 });
  const override = await appendOverride(row, { verdict, feedback });
  const state = await store.update((s) => applyReview(s, answerId, { verdict, feedback, at: new Date().toISOString(), override }));
  return Response.json({ row: state.rows.find((r) => r.answerId === answerId), stats: queueStats(state) });
}
