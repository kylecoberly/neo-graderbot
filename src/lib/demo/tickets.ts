import type { Certainty, Verdict } from "@/lib/types";
import { demoSecret, verify } from "./token";

export const PASS_KINDS = ["terse_correct", "full_correct", "different_but_correct", "small_slip"] as const;
export const FAIL_KINDS = ["misconception", "partial", "different_question", "restates_question", "broken_code"] as const;
export type ResponseKind = (typeof PASS_KINDS)[number] | (typeof FAIL_KINDS)[number];

export interface Bundle {
  question: string;
  reference: string;
  keyPoints: string[];
  responses: { kind: ResponseKind; intended: Verdict; answer: string }[];
}

// What the server hands out, signed, because it remembers nothing: an archive
// page, a generated exercise, or a receipt for one live grading.
export interface PageTicket { kind: "page"; questionId: string; answerIds: string[] }
export interface CustomTicket { kind: "custom"; bundle: Bundle }
export type Ticket = PageTicket | CustomTicket;
// The agent's result rides in the receipt, signed, so agreement and the
// judge's comparison use what the agent actually said, not what the browser
// reports it said.
export interface RunReceipt {
  kind: "run";
  runId: string;
  key: string;
  verdict: Verdict | null;
  note: string | null;
  certainty: Certainty | null;
  deferred: boolean;
}

export function readTicket(token: unknown): Ticket | null {
  if (typeof token !== "string") return null;
  const t = verify<Ticket>(token, demoSecret());
  return t && (t.kind === "page" || t.kind === "custom") ? t : null;
}

export const itemKeys = (t: Ticket) => (t.kind === "page" ? t.answerIds : t.bundle.responses.map((_, i) => String(i)));
