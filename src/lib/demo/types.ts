import type { Certainty, Decision } from "@/lib/types";

// One answer's grading as the browser sees it. A stored result (live: false)
// has no latency and no receipt: it was not graded for this visitor.
export interface AgentResult {
  key: string;
  live: boolean;
  latencyMs: number | null;
  decision: Decision;
  certainty: Certainty | null;
  basis: string | null;
  receipt: string | null;
}
