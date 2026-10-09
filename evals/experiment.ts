import { execSync } from "node:child_process";
import { AGENT_MODEL } from "@/lib/model";
import { JUDGE_MODEL } from "./graders/judge";

// A bad value must not become 0 or NaN: langsmith would register zero test
// runs and the suite would pass having graded nothing.
const reps = Number(process.env.EVAL_REPETITIONS);
export const REPETITIONS = Number.isInteger(reps) && reps > 0 ? reps : 1;

const limit = Number(process.env.EVAL_LIMIT);
export const LIMIT = Number.isInteger(limit) && limit > 0 ? limit : undefined;

export const JUDGE_ON = process.env.EVAL_JUDGE !== "off";

// Experiment names in LangSmith are random; this is how a run is identified
// when comparing rounds.
export function experimentMetadata(): Record<string, string> {
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()) commit += "-dirty";
  } catch {
    // Not a git checkout; "unknown" is fine.
  }
  return {
    commit,
    agent: AGENT_MODEL,
    judge: JUDGE_ON ? JUDGE_MODEL : "off",
    retrieval: process.env.AGENT_RETRIEVAL === "off" ? "off" : "on",
    policy: process.env.AGENT_POLICY === "off" ? "off" : "on",
    repetitions: String(REPETITIONS),
    ...(LIMIT ? { limit: String(LIMIT) } : {}),
    ...(process.env.EVAL_LABEL ? { label: process.env.EVAL_LABEL } : {}),
  };
}
