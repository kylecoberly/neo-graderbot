import { loadReport } from "./reports";
import { paired, unstable } from "./stats";

// pnpm evals:compare <before-label> <after-label>
const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: pnpm evals:compare <before-label> <after-label>");
  process.exit(1);
}
const before = loadReport("core", a);
const after = loadReport("core", b);
const floor = Math.max(unstable(before, "verdict_agrees"), unstable(after, "verdict_agrees"));

console.log(`${a} → ${b}, paired per example (mean over repetitions)\n`);
for (const [key, better] of [
  ["verdict_agrees", "higher"],
  ["recorded_false_reject", "lower"],
  ["recorded_false_accept", "lower"],
  ["recorded", "lower"],
] as const) {
  const p = paired(before, after, key, better);
  const slices = Object.entries(p.bySlice).map(([s, c]) => `${s} +${c.improved} −${c.regressed}`).join(", ");
  console.log(`${key} (${better} is better): improved ${p.improved}, regressed ${p.regressed}  [${slices}]`);
}
const agree = paired(before, after, "verdict_agrees", "higher");
const net = agree.improved - agree.regressed;
console.log(`\nNoise floor: ${floor} examples. verdict_agrees net ${net}: ${net > floor ? "beats the floor, the change counts" : "does not beat the floor"}.`);
