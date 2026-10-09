import { loadDemoQuestions } from "@/lib/data";
import { drawPage } from "@/lib/demo/page";
import { demoSecret, sign } from "@/lib/demo/token";
import { rejectCrossSite } from "@/lib/sameOrigin";
import { SLICES, type Slice } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { slice?: unknown; exclude?: unknown };
  if (body.slice !== undefined && !SLICES.includes(body.slice as Slice)) return Response.json({ error: "Unknown topic." }, { status: 400 });
  if (body.slice !== undefined && !loadDemoQuestions().some((p) => p.slice === body.slice)) {
    return Response.json({ error: "No strong questions in that topic." }, { status: 400 });
  }
  const exclude = Array.isArray(body.exclude) ? body.exclude.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  const page = drawPage({ slice: body.slice as Slice | undefined, exclude }, Math.random);
  const token = sign({ kind: "page", questionId: page.question.id, answerIds: page.answers.map((a) => a.id) }, demoSecret());
  return Response.json({ ...page, token });
}
