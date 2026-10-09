import { leaksReference } from "@/lib/agent/leak";
import type { Verdict } from "@/lib/types";

// Words that carry no pointer at the learner's work: function words and the
// verdict vocabulary ("Not quite", "Look again") that a terse note is made of.
const STOP = new Set(
  "the and you your this that with for are not but what how why does did have has can its just about more there they them was were yes nice good great close almost quite look again answer question right correct wrong here then than into from will would should could also only very really".split(
    " ",
  ),
);
const NUDGE = /\?|\b(try|look at|what happens|check|compare|think about|consider|remember|make sure|how would|walk through)\b/i;
const CODE = /[.()<>/[\]]/;

// Code stays whole ("arr.pop()") and also contributes its names ("arr", "pop"),
// so a note that says "pop" still points at an answer that wrote `arr.pop()`.
export function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/`/g, " ").match(/[a-z0-9_$.()[\]<>/-]+/g) ?? []) {
    const t = raw.replace(/^[.-]+/, "").replace(/[.,;:!?-]+$/, "");
    const parts = t.split(/[^a-z0-9_$]+/).filter((p) => p.length >= 3 && !STOP.has(p));
    if (CODE.test(t) && parts.length) out.add(t);
    for (const p of parts) out.add(p);
  }
  return out;
}

export const vocabularyOf = (texts: string[]) => [...tokens(texts.join("\n"))];

export interface Richness { specific: boolean; grounded: boolean; nudges: boolean; safe: boolean; score: number; words: number }

// One rubric for the visitor's notes and the agent's, so the comparison is
// like for like: points for naming something in the learner's answer, using
// the lesson's language, leaving the learner something to do, and not
// handing over the answer.
export function richness(note: string, ctx: { verdict: Verdict; answer: string; reference: string | null; vocabulary: string[] }): Richness {
  const words = note.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return { specific: false, grounded: false, nudges: false, safe: false, score: 0, words };
  const said = [...tokens(note)];
  const answer = tokens(ctx.answer);
  const lesson = new Set([...ctx.vocabulary, ...tokens(ctx.reference ?? "")]);
  const r = {
    specific: said.some((t) => answer.has(t)),
    grounded: said.some((t) => lesson.has(t)),
    nudges: NUDGE.test(note),
    safe: ctx.verdict === "accept" || !leaksReference(note, ctx.reference, ctx.answer),
  };
  return { ...r, score: Object.values(r).filter(Boolean).length, words };
}
