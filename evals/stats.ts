export interface ReportRow {
  meta?: Record<string, unknown>;
  feedback: { key: string; score: number }[];
  judgeMaterial?: Record<string, string>;
}

export interface Report {
  meta: Record<string, string>;
  rows: Record<string, ReportRow>;
}

const values = (rows: ReportRow[], key: string) =>
  rows.map((r) => r.feedback.find((f) => f.key === key)?.score).filter((v): v is number => v !== undefined);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);

export const pct = (x: number) => (Number.isNaN(x) ? "–" : `${Math.round(x * 100)}%`);

// The headline is false accepts among what the agent actually recorded: a
// deferred disagreement cost the instructor a minute, a recorded one cost the
// learner a wrong grade.
export function coreStats(rows: ReportRow[]) {
  const recorded = sum(values(rows, "recorded"));
  return {
    n: rows.length,
    recorded,
    deferred: 1 - mean(values(rows, "recorded")),
    agreement: mean(values(rows, "verdict_agrees")),
    falseAcceptOfRecorded: recorded ? sum(values(rows, "recorded_false_accept")) / recorded : NaN,
    falseRejectOfRecorded: recorded ? sum(values(rows, "recorded_false_reject")) / recorded : NaN,
    leaked: mean(values(rows, "reference_leaked")),
    grounded: mean(values(rows, "basis_grounded")),
    termFound: mean(values(rows, "retrieval_term_found")),
    hints: mean(values(rows, "judge_hints_not_reveals")),
    accurate: mean(values(rows, "judge_accurate")),
    voice: mean(values(rows, "judge_voice")),
  };
}

export function adversarialStats(rows: ReportRow[]) {
  return { n: rows.length, safe: mean(values(rows, "adversarial_safe")), met: mean(values(rows, "expectation_met")) };
}

export function groupRows(report: Report, metaKey: string): Record<string, ReportRow[]> {
  const groups: Record<string, ReportRow[]> = {};
  for (const r of Object.values(report.rows)) (groups[String(r.meta?.[metaKey] ?? "?")] ??= []).push(r);
  groups.all = Object.values(report.rows);
  return groups;
}

// The noise floor: how many examples scored differently on their own
// repetitions. A change between rounds counts only if it beats this.
export function unstable(report: Report, key: string): number {
  const byExample: Record<string, Set<number>> = {};
  for (const [id, r] of Object.entries(report.rows)) {
    const score = r.feedback.find((f) => f.key === key)?.score;
    if (score === undefined) continue;
    (byExample[id.replace(/ #\d+$/, "")] ??= new Set()).add(score);
  }
  return Object.values(byExample).filter((s) => s.size > 1).length;
}

type Run = { label: string; report: Report };

function table(runs: Run[], metaKey: string, columns: [string, (rows: ReportRow[]) => number][], first: string): string {
  const groups = runs.map((r) => groupRows(r.report, metaKey));
  const names = Object.keys(groups[0]);
  const lines = [
    `| ${first} | n | ${columns.map(([c]) => c).join(" | ")} |`,
    `|${" --- |".repeat(columns.length + 2)}`,
    ...names.map((name) => {
      const cells = columns.map(([, f]) => groups.map((g) => pct(g[name] ? f(g[name]) : NaN)).join(" → "));
      return `| ${name} | ${groups[0][name].length} | ${cells.join(" | ")} |`;
    }),
  ];
  return lines.join("\n");
}

export function coreTable(runs: Run[]): string {
  return table(
    runs,
    "slice",
    [
      ["deferred", (r) => coreStats(r).deferred],
      ["agreement", (r) => coreStats(r).agreement],
      ["false accept (of recorded)", (r) => coreStats(r).falseAcceptOfRecorded],
      ["false reject (of recorded)", (r) => coreStats(r).falseRejectOfRecorded],
      ["leaked", (r) => coreStats(r).leaked],
      ["grounded", (r) => coreStats(r).grounded],
      ["term found", (r) => coreStats(r).termFound],
      ["hints", (r) => coreStats(r).hints],
      ["accurate", (r) => coreStats(r).accurate],
      ["voice", (r) => coreStats(r).voice],
    ],
    "slice",
  );
}

export function adversarialTable(runs: Run[]): string {
  return table(
    runs,
    "category",
    [
      ["safe", (r) => adversarialStats(r).safe],
      ["expectation met", (r) => adversarialStats(r).met],
    ],
    "category",
  );
}

type Direction = "higher" | "lower";
interface Counts { improved: number; regressed: number }

// The decision rule, as code: per example (mean over its repetitions), did
// the key move the better way or the worse way between two runs? A change
// counts when improved − regressed beats the noise floor (`unstable`).
export function paired(before: Report, after: Report, key: string, better: Direction): Counts & { bySlice: Record<string, Counts> } {
  const means = (r: Report) => {
    const acc: Record<string, { slice: string; scores: number[] }> = {};
    for (const [id, row] of Object.entries(r.rows)) {
      const score = row.feedback.find((f) => f.key === key)?.score;
      if (score === undefined) continue;
      const ex = (acc[id.replace(/ #\d+$/, "")] ??= { slice: String(row.meta?.slice ?? "?"), scores: [] });
      ex.scores.push(score);
    }
    return Object.fromEntries(Object.entries(acc).map(([id, v]) => [id, { slice: v.slice, mean: mean(v.scores) }]));
  };
  const a = means(before);
  const b = means(after);
  const out = { improved: 0, regressed: 0, bySlice: {} as Record<string, Counts> };
  for (const [id, x] of Object.entries(a)) {
    const y = b[id];
    if (!y || y.mean === x.mean) continue;
    const up = better === "higher" ? y.mean > x.mean : y.mean < x.mean;
    const slice = (out.bySlice[x.slice] ??= { improved: 0, regressed: 0 });
    if (up) {
      out.improved += 1;
      slice.improved += 1;
    } else {
      out.regressed += 1;
      slice.regressed += 1;
    }
  }
  return out;
}
