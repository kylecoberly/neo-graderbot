import type { GuardResult } from "@/lib/types";
import { EMAIL, PHONE } from "./mask";

// The longest real answer in the archive is 1,933 characters.
export const MAX_ANSWER_CHARS = 2500;

// Non-global copies of the masking patterns: .test() on a /g regex carries
// lastIndex between calls.
const PII: { name: string; pattern: RegExp }[] = [
  { name: "email", pattern: new RegExp(EMAIL.source) },
  { name: "phone", pattern: new RegExp(PHONE.source) },
];

// Extend by adding a named pattern; never loosen an existing one. Each pattern
// must keep passing the archive test in guard.data.test.ts.
export const INJECTION_PATTERNS: { name: string; pattern: RegExp }[] = [
  {
    name: "ignore_instructions",
    pattern: /\b(ignore|disregard|forget|override)\s+(all\s+|any\s+)?((the|your|previous|prior|above)\s+)*(instructions?|rubric|rules|prompt|guidelines)\b/i,
  },
  {
    name: "addressed_to_grader",
    pattern: /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(grader|evaluator|ai|assistant|model|reviewer|llm)\b/i,
  },
  {
    name: "dictates_grade",
    pattern: /\b(mark|grade|score|rate|accept)\s+(this|me|it|my\s+answer)\s+(as\s+)?(correct|accepted|right|passing|full\s+marks|100)\b/i,
  },
  { name: "role_marker", pattern: /^\s*(system|assistant)\s*:/im },
  { name: "verdict_json", pattern: /"(verdict|certainty)"\s*:/i },
  { name: "persona_swap", pattern: /\b(you are now|pretend (that )?you are|from now on you)\b/i },
];

// Patterns run on a normalised copy: full-width letters fold to ASCII and
// invisible format characters (zero-width joiners and the like) are dropped,
// so "ig\u200Bnore" cannot split a word past a pattern. Look-alike letters from
// other scripts and paraphrases still get through; the prompt's framing and
// the adversarial evals cover what a pattern list cannot.
// The graph hands the model this same normalised text, so what the guard
// checked is exactly what the model reads.
export const normaliseAnswer = (s: string) => s.normalize("NFKC").replace(/\p{Cf}/gu, "");

export function checkGuard(raw: string): GuardResult {
  const answer = normaliseAnswer(raw);
  if (!/[\p{L}\p{N}]/u.test(answer)) return { tripped: true, guard: "empty", detail: "no letters or digits" };
  const longest = Math.max(raw.length, answer.length);
  if (longest > MAX_ANSWER_CHARS) return { tripped: true, guard: "too_long", detail: `${longest} characters` };
  for (const { name, pattern } of PII) if (pattern.test(answer)) return { tripped: true, guard: "pii", detail: name };
  for (const { name, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(answer)) return { tripped: true, guard: "injection", detail: name };
  }
  return { tripped: false };
}
