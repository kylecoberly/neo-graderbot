import { loadReport } from "./reports";
import { adversarialTable, coreTable, unstable } from "./stats";

const labels = process.argv.slice(2);
if (!labels.length) {
  console.error("usage: pnpm evals:summary <label> [<label> …]   (labels are EVAL_LABEL values, e.g. r1-baseline r3-policy)");
  process.exit(1);
}

const core = labels.map((label) => ({ label, report: loadReport("core", label) }));
const adversarial = labels.map((label) => ({ label, report: loadReport("adversarial", label) }));

console.log(`## Core: ${labels.join(" → ")}\n`);
console.log(coreTable(core));
console.log(`\nNoise floor (examples whose verdict_agrees differed across repetitions): ${core.map((r) => `${r.label} ${unstable(r.report, "verdict_agrees")}`).join(", ")}`);
console.log(`\n## Adversarial: ${labels.join(" → ")}\n`);
console.log(adversarialTable(adversarial));
console.log(`\nRun metadata: ${core.map((r) => `${r.label} ${JSON.stringify(r.report.meta)}`).join("; ")}`);
