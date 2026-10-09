import type { Feedback } from "./graders/types";
import { writeReports } from "./reports";

// Local visibility without a LangSmith key: the suite table on the console,
// and every row (meta, scores, output, exactly what the judge saw) in the
// files evals/reports.ts describes.
interface Row<Output> {
  meta: Record<string, unknown>;
  feedback: Feedback[];
  output?: Output;
  inputs?: unknown;
  reference?: unknown;
  judgeMaterial?: Record<string, string>;
}

export class LocalReport<Output> {
  private rows: Record<string, Row<Output>> = {};

  constructor(
    private readonly name: string,
    private readonly meta: Record<string, string> = {},
  ) {}

  start(exampleId: string, repetition = 0, meta: Record<string, unknown> = {}): string {
    const id = repetition > 0 ? `${exampleId} #${repetition + 1}` : exampleId;
    this.rows[id] = { meta, feedback: [] };
    return id;
  }

  output(id: string, output: Output) {
    this.rows[id].output = output;
  }

  context(id: string, inputs: unknown, reference: unknown, judgeMaterial: Record<string, string>) {
    Object.assign(this.rows[id], { inputs, reference, judgeMaterial });
  }

  record(id: string, feedback: Feedback) {
    this.rows[id].feedback.push(feedback);
  }

  scores(id: string): Record<string, number> {
    return Object.fromEntries(this.rows[id].feedback.map((f) => [f.key, f.score]));
  }

  suite(): Record<string, { mean: number; n: number }> {
    const byKey: Record<string, number[]> = {};
    for (const row of Object.values(this.rows)) for (const f of row.feedback) (byKey[f.key] ??= []).push(f.score);
    return Object.fromEntries(
      Object.entries(byKey).map(([key, v]) => [key, { mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), n: v.length }]),
    );
  }

  flush() {
    console.table(this.suite());
    writeReports(this.name, this.meta.label, { meta: this.meta, rows: this.rows });
  }
}
