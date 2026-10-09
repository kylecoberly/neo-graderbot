import { checkGuard, normaliseAnswer } from "@/lib/agent/guard";

import { QUESTION_MAX_CHARS as QUESTION_MAX, QUESTION_MIN_CHARS as QUESTION_MIN } from "./limits";

export { QUESTION_MAX, QUESTION_MIN };

const SEVERAL = /\?[\s\S]*\?|\band also\b|(^|\n)\s*(\d+|[a-z])[.)]\s/i;
const REASON = {
  empty: "Write a question.",
  too_long: `Keep it under ${QUESTION_MAX} characters.`,
  pii: "Leave out contact details.",
  injection: "That reads like instructions to the grader, not a question.",
} as const;

// Cheap refusals before any model call; the generator's fit check handles
// what patterns can't (opinion, essays, current events).
export function checkQuestion(raw: string): { ok: true; question: string } | { ok: false; reason: string } {
  const question = normaliseAnswer(raw).trim();
  if (question.length < QUESTION_MIN) return { ok: false, reason: "Write a full question, at least a few words." };
  if (question.length > QUESTION_MAX) return { ok: false, reason: REASON.too_long };
  const guard = checkGuard(question);
  if (guard.tripped) return { ok: false, reason: REASON[guard.guard] };
  if (SEVERAL.test(question)) return { ok: false, reason: "Ask one question at a time." };
  return { ok: true, question };
}
