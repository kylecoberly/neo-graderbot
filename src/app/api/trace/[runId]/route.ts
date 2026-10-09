import { Client } from "langsmith";
import { localOnly } from "@/lib/localOnly";
import { rejectForeignHost } from "@/lib/sameOrigin";

export const dynamic = "force-dynamic";

// Resolved on click rather than when the row is built: by then the run has
// reached LangSmith and the URL can be looked up.
export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const hidden = localOnly();
  if (hidden) return hidden;
  const blocked = rejectForeignHost(request);
  if (blocked) return blocked;
  const { runId } = await params;
  if (!process.env.LANGSMITH_API_KEY) {
    return new Response("Tracing is off: set LANGSMITH_API_KEY and LANGSMITH_TRACING=true.", { status: 404 });
  }
  try {
    return Response.redirect(await new Client().getRunUrl({ runId }), 302);
  } catch {
    return new Response("That trace hasn't reached LangSmith yet; try again in a few seconds.", { status: 404 });
  }
}
