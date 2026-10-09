import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Certainty, Decision } from "@/lib/types";

export interface StoredResult { decision: Decision; certainty: Certainty | null; basis: string | null }

let cache: Record<string, StoredResult> | null = null;

// Written once by `pnpm demo:precompute`; read when a live call fails so a
// reviewer never meets a broken page.
export function storedResult(answerId: string): StoredResult | null {
  if (!cache) {
    const file = join(process.cwd(), "data", "demo-fallback.json");
    cache = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, StoredResult>) : {};
  }
  return cache[answerId] ?? null;
}
