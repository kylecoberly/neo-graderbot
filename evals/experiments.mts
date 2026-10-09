import { existsSync } from "node:fs";
import { Client } from "langsmith";

// Which LangSmith experiment holds each round, with the figures only
// LangSmith has: latency and cost per root run. Usage: pnpm evals:experiments [label …]
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const wanted = new Set(process.argv.slice(2));
const client = new Client();
const org = process.env.LANGSMITH_ORG_ID ?? "";

for (const dataset of ["neo-graderbot-core", "neo-graderbot-adversarial"]) {
  console.log(`\n## ${dataset}\n`);
  console.log("| label | experiment | runs | p50 latency | cost per 100 |\n| --- | --- | --- | --- | --- |");
  for await (const p of client.listProjects({ referenceDatasetName: dataset })) {
    const meta = (p.extra as { metadata?: Record<string, string> } | undefined)?.metadata ?? {};
    const label = meta.label ?? "";
    if (wanted.size && !wanted.has(label)) continue;
    const latencies: number[] = [];
    let cost = 0;
    let n = 0;
    for await (const run of client.listRuns({ projectId: p.id, isRoot: true, select: ["start_time", "end_time", "total_cost"] })) {
      n += 1;
      if (run.start_time && run.end_time) latencies.push(new Date(run.end_time).getTime() - new Date(run.start_time).getTime());
      cost += Number((run as { total_cost?: unknown }).total_cost ?? 0);
    }
    latencies.sort((a, b) => a - b);
    const p50 = latencies.length ? (latencies[Math.floor(latencies.length / 2)] / 1000).toFixed(1) + " s" : "–";
    const url = org ? `https://smith.langchain.com/o/${org}/projects/p/${p.id}` : p.id;
    console.log(`| ${label || "(none)"} | [${p.name}](${url}) | ${n} | ${p50} | $${n ? ((cost / n) * 100).toFixed(2) : "–"} |`);
  }
}
