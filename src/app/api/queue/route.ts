import { queueStats } from "@/lib/queue/state";
import { queueStore } from "@/lib/queue/store";
import { localOnly } from "@/lib/localOnly";
import { rejectCrossSite, rejectForeignHost } from "@/lib/sameOrigin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hidden = localOnly();
  if (hidden) return hidden;
  const blocked = rejectForeignHost(request);
  if (blocked) return blocked;
  const state = await queueStore().read();
  return Response.json({ rows: state.rows, stats: queueStats(state) });
}

export async function DELETE(request: Request) {
  const hidden = localOnly();
  if (hidden) return hidden;
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const state = await queueStore().reset();
  return Response.json({ rows: state.rows, stats: queueStats(state) });
}
