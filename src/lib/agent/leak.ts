import type { Passage } from "@/lib/types";

export const LEAK_NGRAM = 6;
const MIN_REFERENCE_WORDS = 4;

const words = (s: string) => s.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
const grams = (ws: string[], n: number) =>
  ws.length < n ? [] : Array.from({ length: ws.length - n + 1 }, (_, i) => ws.slice(i, i + n).join(" "));

// A rejection note gives the answer away when it repeats a run of the
// reference that the learner did not already write. Quoting the learner's own
// correct lines back is how you point at the wrong one, so those don't count.
// A reference of a few words ("Yes") can't be detected this way without
// flagging every note, so it isn't checked.
export function leaksReference(feedback: string, reference: string | null, answer: string): boolean {
  if (!reference) return false;
  const ref = words(reference);
  if (ref.length < MIN_REFERENCE_WORDS) return false;
  const n = Math.min(LEAK_NGRAM, ref.length);
  const learner = new Set(grams(words(answer), n));
  const said = new Set(grams(words(feedback), n));
  return grams(ref, n).some((g) => said.has(g) && !learner.has(g));
}

const COPY_NGRAM = 12;

// Twelve words of the lesson in a row were pasted, not written. Round 3
// recorded full marks for pasted lesson text in 9 of 12 adversarial runs.
export function copiesPassage(answer: string, passages: Passage[]): boolean {
  const said = new Set(grams(words(answer), COPY_NGRAM));
  if (!said.size) return false;
  return passages.some((p) => grams(words(p.text), COPY_NGRAM).some((g) => said.has(g)));
}
