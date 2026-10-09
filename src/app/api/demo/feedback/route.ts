import { z } from "zod";
import { labelsOn, readReceipt, writeLabels } from "@/lib/demo/labels";
import { rejectCrossSite } from "@/lib/sameOrigin";

export const dynamic = "force-dynamic";

const schema = z.object({ verdicts: z.array(z.object({ receipt: z.string(), verdict: z.enum(["accept", "reject"]) })).max(8) });

// Each visitor's verdicts become feedback on the agent's own traces, so the
// demo's LangSmith project fills with labelled production-like data. Only
// runs this server signed can be labelled, and agreement is computed here
// from the agent's signed verdict.
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  if (!labelsOn()) return new Response(null, { status: 204 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid feedback." }, { status: 400 });
  const labels = parsed.data.verdicts.flatMap(({ receipt, verdict }) => {
    const r = readReceipt(receipt);
    return r?.verdict ? [{ runId: r.runId, key: "visitor_agrees", score: verdict === r.verdict ? 1 : 0, value: verdict }] : [];
  });
  return Response.json({ written: await writeLabels(labels) });
}
