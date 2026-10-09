import type { Verdict } from "@/lib/types";

export const SPOT_CHECK = 0.2;

export interface Settled { live: boolean; latencyMs: number | null; deferred: boolean }
export interface Efficiency { byHandMs: number; withAgentMs: number; medianMs: number; deferred: number; recorded: number; agentWallMs: number | null }
export type SpeedLine =
  | { kind: "graded"; n: number; m: number }
  | { kind: "projected"; count: number; yourMs: number; agentMs: number }
  | { kind: "agentOnly"; count: number; agentMs: number }
  | { kind: "unavailable" };

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const liveLatencies = (results: Settled[]) => results.flatMap((r) => (r.live && r.latencyMs !== null ? [r.latencyMs] : []));

// With the agent, the visitor still reads what it flagged and spot-checks a
// fifth of what it filed, both at the visitor's own pace on this page.
export function efficiency(activeMs: number[], results: Settled[]): Efficiency {
  const medianMs = median(activeMs.filter((ms) => ms > 0));
  const deferred = results.filter((r) => r.deferred).length;
  const recorded = results.length - deferred;
  const latencies = liveLatencies(results);
  const agentWallMs = latencies.length ? Math.max(...latencies) : null;
  return {
    byHandMs: activeMs.reduce((a, b) => a + b, 0),
    withAgentMs: Math.round((deferred + SPOT_CHECK * recorded) * medianMs + (agentWallMs ?? 0)),
    medianMs,
    deferred,
    recorded,
    agentWallMs,
  };
}

// Mean latency one answer at a time, not the parallel wall-clock, so the
// claim stays modest. Stored results have no latency and don't count.
export function speedLine(o: { gradedCount: number; activeTotalMs: number | null; priorMedianMs: number | null; results: Settled[] }): SpeedLine {
  const latencies = liveLatencies(o.results);
  if (!latencies.length) return { kind: "unavailable" };
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  if (o.activeTotalMs !== null && o.gradedCount > 0) return { kind: "graded", n: o.gradedCount, m: Math.floor(o.activeTotalMs / mean) };
  if (o.priorMedianMs !== null) {
    return { kind: "projected", count: o.results.length, yourMs: Math.round(o.priorMedianMs * o.results.length), agentMs: Math.max(...latencies) };
  }
  return { kind: "agentOnly", count: o.results.length, agentMs: Math.max(...latencies) };
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export function speedText(s: SpeedLine): string {
  if (s.kind === "graded") return `In the time it took you to grade ${s.n} responses, GraderBot could have graded ${s.m}.`;
  if (s.kind === "projected") {
    return `At your pace on the first page, these ${s.count} would have taken you about ${formatDuration(s.yourMs)}; GraderBot took ${formatDuration(s.agentMs)}.`;
  }
  if (s.kind === "agentOnly") {
    return `GraderBot graded these ${s.count} in ${formatDuration(s.agentMs)}. Grade an archive page first to see how that compares with your pace.`;
  }
  return "Live grading was unavailable, so there's no timing to compare.";
}

export function agreement(pairs: { visitor: Verdict; agent: Verdict | null }[]): { agree: number; compared: number } {
  const compared = pairs.filter((p) => p.agent !== null);
  return { agree: compared.filter((p) => p.agent === p.visitor).length, compared: compared.length };
}
