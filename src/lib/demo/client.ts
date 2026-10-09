import { parseEvents } from "@/lib/sse";
import type { AgentState, JudgeRow } from "./results";
import type { AgentResult } from "./types";

// sessionStorage keys: the first page's pace (for the skip-mode projection)
// and the questions already shown (so "another page" is another question).
export const PACE_KEY = "graderbot:pace";
export const SEEN_KEY = "graderbot:seen";

const UNAVAILABLE = "Live grading is unavailable right now.";

// Calls onEvent for each event; returning true stops reading, so a caller
// can settle on its final event without waiting for the server to close.
export async function readStream(res: Response, onEvent: (e: { event: string; data: unknown }) => boolean | void): Promise<void> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    const parsed = parseEvents(buffer + value);
    buffer = parsed.rest;
    for (const e of parsed.events) {
      if (onEvent(e) === true) {
        void reader.cancel().catch(() => {});
        return;
      }
    }
  }
}

export const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Never rejects: a dropped connection becomes an error card, so the page can
// still settle and total up.
export async function gradeItem(token: string, key: string, onDraft: (text: string) => void): Promise<AgentState> {
  try {
    const res = await post("/api/demo/grade", { token, key });
    if (res.status === 401) return { status: "error", message: "expired" };
    if (!res.ok || !res.body) return { status: "error", message: UNAVAILABLE };
    let state: AgentState = { status: "error", message: "The grading stream ended early." };
    await readStream(res, (e) => {
      if (e.event === "feedback") onDraft((e.data as { text: string }).text);
      if (e.event === "done") state = { status: "done", result: (e.data as { result: AgentResult }).result };
      if (e.event === "error") state = { status: "error", message: (e.data as { message: string }).message };
      return e.event === "done" || e.event === "error";
    });
    return state;
  } catch {
    return { status: "error", message: UNAVAILABLE };
  }
}

export async function runJudge(
  token: string,
  items: unknown[],
  onPartial: (rows: JudgeRow[], summary: string) => void,
): Promise<{ rows: JudgeRow[]; summary: string } | "expired" | null> {
  try {
    const res = await post("/api/demo/judge", { token, items });
    if (res.status === 401) return "expired";
    if (!res.ok || !res.body) return null;
    let final: { rows: JudgeRow[]; summary: string } | null = null;
    await readStream(res, (e) => {
      const j = (e.data as { judgment?: { answers?: Partial<JudgeRow>[]; summary?: string } }).judgment;
      if (!j) return e.event === "error";
      // Partial JSON: a row is shown once its key has arrived.
      const rows = (j.answers ?? []).filter((r): r is JudgeRow => !!r && typeof r.key === "string");
      if (e.event === "partial") onPartial(rows, j.summary ?? "");
      if (e.event === "done") final = { rows, summary: j.summary ?? "" };
      return e.event === "done";
    });
    return final;
  } catch {
    return null;
  }
}
