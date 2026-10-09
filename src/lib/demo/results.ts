import type { Verdict } from "@/lib/types";
import { agreement, efficiency, speedLine, type Efficiency, type SpeedLine } from "./efficiency";
import { richness, type Richness } from "./richness";
import type { ResponseKind } from "./tickets";
import type { Timing } from "./timing";
import type { AgentResult } from "./types";

export interface Entry { key: string; learner: string | null; answer: string; kind?: ResponseKind; intended?: Verdict }
export interface VisitorGrade { verdict: Verdict | null; note: string }
export type AgentState = { status: "pending"; draft: string } | { status: "done"; result: AgentResult } | { status: "error"; message: string };
export interface JudgeRow { key: string; reason: string; better_verdict: string; better_note: string; comment: string }
export interface Row { agree: boolean | null; visitorRichness: Richness | null; agentRichness: Richness | null; keyAgrees: boolean | null }
export interface Summary {
  settled: boolean;
  rows: Record<string, Row>;
  agreement: { agree: number; compared: number };
  richness: { visitor: number; agent: number };
  keyMatch: { agree: number; compared: number } | null;
  judgeTally: { verdict: Record<string, number>; note: Record<string, number> } | null;
  efficiency: Efficiency | null;
  speed: SpeedLine | null;
}

// How the results page names each side of the judge's comparison.
export const WHO: Record<string, string> = { visitor: "you", agent: "GraderBot", both: "both", neither: "neither", tie: "tie" };

export const canSubmit = (grades: Record<string, VisitorGrade>, keys: string[]) => keys.every((k) => grades[k]?.verdict);
export const agentVerdict = (r: AgentResult): Verdict | null => r.decision.verdict;
// The judge streams: a row's fields arrive one by one, so count only values that have arrived.
const tally = (xs: (string | undefined)[]) =>
  xs.reduce<Record<string, number>>((m, x) => (typeof x === "string" && x ? { ...m, [x]: (m[x] ?? 0) + 1 } : m), {});

// Everything the results page shows, recomputed on every render: per-answer
// rows fill in as calls finish; page totals wait until every call has settled.
export function summarise(o: {
  entries: Entry[];
  grades: Record<string, VisitorGrade> | null;
  agent: Record<string, AgentState>;
  timing: Timing | null;
  priorMedianMs: number | null;
  reference: string | null;
  vocabulary: string[];
  judge: JudgeRow[] | null;
}): Summary {
  const rows: Record<string, Row> = {};
  const pairs: { visitor: Verdict; agent: Verdict | null }[] = [];
  const keyPairs: { visitor: Verdict; agent: Verdict | null }[] = [];
  const totals = { visitor: 0, agent: 0 };
  for (const e of o.entries) {
    const g = o.grades?.[e.key];
    const a = o.agent[e.key];
    const result = a?.status === "done" ? a.result : null;
    const verdict = result ? agentVerdict(result) : null;
    const ctx = { answer: e.answer, reference: o.reference, vocabulary: o.vocabulary };
    const visitorRichness = g?.verdict ? richness(g.note, { ...ctx, verdict: g.verdict }) : null;
    const agentRichness = verdict && result?.decision.feedback ? richness(result.decision.feedback, { ...ctx, verdict }) : null;
    totals.visitor += visitorRichness?.score ?? 0;
    totals.agent += agentRichness?.score ?? 0;
    if (g?.verdict && a && a.status !== "pending") pairs.push({ visitor: g.verdict, agent: verdict });
    if (e.intended && result) keyPairs.push({ visitor: e.intended, agent: verdict });
    rows[e.key] = {
      agree: g?.verdict && verdict ? g.verdict === verdict : null,
      visitorRichness,
      agentRichness,
      keyAgrees: e.intended && verdict ? e.intended === verdict : null,
    };
  }
  const settled = o.entries.every((e) => o.agent[e.key] && o.agent[e.key].status !== "pending");
  // A failed call is an answer the visitor would still have to grade, so it
  // counts as deferred; it has no latency to count.
  const settledResults = o.entries.flatMap((e) => {
    const a = o.agent[e.key];
    if (a?.status === "error") return [{ live: false, latencyMs: null, deferred: true }];
    return a?.status === "done" ? [{ live: a.result.live, latencyMs: a.result.latencyMs, deferred: a.result.decision.action === "defer" }] : [];
  });
  const activeMs = o.timing ? o.entries.map((e) => o.timing!.activeMs[e.key] ?? 0) : [];
  const graded = o.grades ? o.entries.filter((e) => o.grades![e.key]?.verdict).length : 0;
  return {
    settled,
    rows,
    agreement: agreement(pairs),
    richness: totals,
    keyMatch: o.entries.some((e) => e.intended) ? agreement(keyPairs) : null,
    judgeTally: o.judge ? { verdict: tally(o.judge.map((j) => j.better_verdict)), note: tally(o.judge.map((j) => j.better_note)) } : null,
    efficiency: settled && o.timing ? efficiency(activeMs, settledResults) : null,
    speed: settled
      ? speedLine({
          gradedCount: graded,
          activeTotalMs: o.timing ? activeMs.reduce((x, y) => x + y, 0) : null,
          priorMedianMs: o.priorMedianMs,
          results: settledResults,
        })
      : null,
  };
}

export const receiptOf = (a: AgentState | undefined) => (a?.status === "done" ? a.result.receipt : null);

// What the visitor's page adds to the agent's traces: the visitor's verdict
// for each run graded live for them (stored results have no receipt). The
// server works out agreement from the agent's signed verdict.
export function feedbackPayload(entries: Entry[], agent: Record<string, AgentState>, grades: Record<string, VisitorGrade>) {
  return {
    verdicts: entries.flatMap((e) => {
      const receipt = receiptOf(agent[e.key]);
      const verdict = grades[e.key]?.verdict;
      return receipt && verdict ? [{ receipt, verdict }] : [];
    }),
  };
}
