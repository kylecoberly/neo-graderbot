import { createHash } from "node:crypto";
import { sliceOfQuestion } from "@/lib/topics";
import { SLICES, type GradedAnswer, type Question, type Splits } from "@/lib/types";
import { mulberry32, shuffle } from "@/lib/random";

export interface PerformanceRow {
  id: number;
  createdAt: string;
  userId: string;
  postSlug: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface EvaluationRow {
  id: number;
  status: string;
  feedback: string | null;
  performanceId: number;
  createdAt: string;
  evaluatorId: string;
}

export const SEED = 20261007;
export const HELDOUT_PER_SLICE = 10;
export const CORE_PER_SLICE = 60;
export const MAX_PAIRS_PER_SLICE = 6;

const text = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

export function toPerformances(rows: Record<string, string | null>[]): { performances: PerformanceRow[]; unparsable: number } {
  const performances: PerformanceRow[] = [];
  let unparsable = 0;
  for (const r of rows) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(r.payload ?? "{}") as Record<string, unknown>;
    } catch {
      unparsable += 1;
      continue;
    }
    performances.push({
      id: Number(r.id),
      createdAt: text(r.createdAt),
      userId: text(r.userId),
      postSlug: text(r.postSlug),
      type: text(r.type),
      payload,
    });
  }
  return { performances, unparsable };
}

export function toEvaluations(rows: Record<string, string | null>[]): EvaluationRow[] {
  return rows
    .filter((r) => r.performanceId !== null)
    .map((r) => ({
      id: Number(r.id),
      status: text(r.status),
      feedback: r.feedback,
      performanceId: Number(r.performanceId),
      createdAt: text(r.createdAt),
      evaluatorId: text(r.evaluatorId),
    }));
}

// Ordered by a salted hash of the address. The salt is secret (.env.local),
// so the numbering reveals neither the alphabet, nor who joined first, nor
// (to someone holding the roster) who is who.
export function pseudonyms(userIds: string[], salt: string): Map<string, string> {
  if (!salt) throw new Error("pseudonyms need a secret salt (GRADERBOT_SALT)");
  const key = (u: string) => sha(`${salt}:${u}`);
  const unique = [...new Set(userIds)].sort((a, b) => key(a).localeCompare(key(b)));
  return new Map(unique.map((u, i) => [u, `learner-${String(i + 1).padStart(2, "0")}`]));
}

// A learner's email handle is their username on most machines, so it turns
// up in answers as home directories and prompts ("/home/<handle>"). The names
// inside it ("rivera" in "rivera.jamie") are identifying on their own.
export function handlesOf(emails: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const email of emails) {
    const whole = email.split("@")[0].toLowerCase().replace(/\d+/g, "");
    for (const h of [whole, ...whole.split(/[._-]+/)]) if (h.length >= 4) out.add(h);
  }
  return [...out];
}

// \b treats "_" as part of a word, so "jdoe_notes" would slip past it.
const handlePattern = (h: string) => new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(h)}\\d*(?![A-Za-z0-9])`, "gi");

// Folder names that are placeholders or ordinary directories, not someone's
// username, when they follow /home/ or /Users/ in an answer.
const NOT_A_USERNAME = new Set([
  "user", "username", "you", "yourname", "your-name", "your_name", "name", "me", "learner",
  "pictures", "documents", "desktop", "downloads", "shared", "public", "music", "videos",
]);
const HOME_PATH = /(\/home\/|\/Users\/|[A-Za-z]:\\Users\\|(?<![\w/~.:])~(?=[A-Za-z]))(\w[\w.-]*\w|\w)/gi;

export function redact(input: string, client: string, handles: string[] = []): string {
  const name = new RegExp(`\\b${escapeRegExp(client)}\\b`, "gi");
  const withoutHandles = handles.reduce(
    (text, h) => text.replace(handlePattern(h), "learner"),
    input,
  );
  return withoutHandles
    .replace(HOME_PATH, (whole, prefix: string, name: string) => (NOT_A_USERNAME.has(name.toLowerCase()) ? whole : `${prefix}learner`))
    .replace(EMAIL, "[email]")
    .replace(name, (m) => (m === m.toUpperCase() ? "VOLVO" : m[0] === m[0].toUpperCase() ? "Volvo" : "volvo"));
}

function questionSlice(p: PerformanceRow) {
  return p.type === "question" ? sliceOfQuestion(p.postSlug) : null;
}

export function buildQuestions(perfs: PerformanceRow[], client: string, handles: string[] = []): Question[] {
  const latest = new Map<string, PerformanceRow>();
  for (const p of perfs) {
    if (!questionSlice(p)) continue;
    const prev = latest.get(p.postSlug);
    if (!prev || p.createdAt > prev.createdAt) latest.set(p.postSlug, p);
  }
  return [...latest.values()]
    .map((p) => {
      const ref = text(p.payload.answer).trim();
      return {
        id: p.postSlug,
        slice: questionSlice(p)!,
        prompt: redact(text(p.payload.prompt).trim(), client, handles),
        reference: ref === "" || ref === "Placeholder" ? null : redact(ref, client, handles),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

export function buildAnswers(
  perfs: PerformanceRow[],
  evals: EvaluationRow[],
  names: Map<string, string>,
  client: string,
): GradedAnswer[] {
  const latestEval = new Map<number, EvaluationRow>();
  for (const e of evals) {
    const prev = latestEval.get(e.performanceId);
    if (!prev || e.id > prev.id) latestEval.set(e.performanceId, e);
  }
  // "deferred" in the archive means a newer attempt superseded this one before
  // it was graded; it is not a judgment, so it is dropped.
  const kept = perfs
    .filter((p) => questionSlice(p) && ["accepted", "rejected"].includes(latestEval.get(p.id)?.status ?? ""))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const attempts = new Map<string, number>();
  const handles = handlesOf(names.keys());
  return kept.map((p) => {
    const key = `${p.userId}|${p.postSlug}`;
    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    const e = latestEval.get(p.id)!;
    const feedback = e.feedback?.trim();
    return {
      id: `a-${p.id}`,
      questionId: p.postSlug,
      slice: questionSlice(p)!,
      learner: names.get(p.userId)!,
      answer: redact(text(p.payload.response), client, handles),
      attempt,
      verdict: e.status === "accepted" ? "accept" : "reject",
      feedback: feedback ? redact(feedback, client, handles) : null,
      answeredOn: p.createdAt.slice(0, 10),
    };
  });
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

const groupKey = (a: GradedAnswer) => `${a.learner}|${a.questionId}`;

export function findHardPairs(answers: GradedAnswer[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const group of groupBy(answers, groupKey).values()) {
    const ordered = [...group].sort((a, b) => a.attempt - b.attempt);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i - 1].verdict === "reject" && ordered[i].verdict === "accept") pairs.push([ordered[i - 1].id, ordered[i].id]);
    }
  }
  return pairs;
}

// Splits by (learner, question) group, so a learner's other attempt at the
// same question can never sit on the other side of the split.
export function split(answers: GradedAnswer[], pairs: [string, string][], seed = SEED): Splits {
  const rng = mulberry32(seed);
  const pairByReject = new Map(pairs.map((p) => [p[0], p]));
  const heldout: string[] = [];
  const core: string[] = [];
  const hardPairs: [string, string][] = [];

  for (const slice of SLICES) {
    const inSlice = answers.filter((a) => a.slice === slice);
    const groups = shuffle([...groupBy(inSlice, groupKey).values()], rng);
    const used = new Set<number>();

    let held = 0;
    for (let g = 0; g < groups.length && held < HELDOUT_PER_SLICE; g++) {
      heldout.push(...groups[g].map((a) => a.id));
      held += groups[g].length;
      used.add(g);
    }

    let pairsTaken = 0;
    for (let g = 0; g < groups.length && pairsTaken < MAX_PAIRS_PER_SLICE; g++) {
      if (used.has(g)) continue;
      const pair = groups[g].map((a) => pairByReject.get(a.id)).find((p) => p !== undefined);
      if (!pair) continue;
      core.push(...pair);
      hardPairs.push(pair);
      pairsTaken += 1;
      used.add(g);
    }

    const rate = inSlice.filter((a) => a.verdict === "reject").length / Math.max(1, inSlice.length);
    let wantReject = Math.max(0, Math.round(CORE_PER_SLICE * rate) - pairsTaken);
    let wantAccept = CORE_PER_SLICE - pairsTaken * 2 - wantReject;
    // One row per group: most rejections led to a retry, so the rejections
    // a slice needs mostly live in groups with several attempts.
    for (let g = 0; g < groups.length && wantReject + wantAccept > 0; g++) {
      if (used.has(g)) continue;
      const a = groups[g].find((x) => (x.verdict === "reject" ? wantReject : wantAccept) > 0);
      if (!a) continue;
      if (a.verdict === "reject") wantReject -= 1;
      else wantAccept -= 1;
      core.push(a.id);
      used.add(g);
    }
  }
  return { seed, heldout, core, hardPairs };
}

// A learner's email handle surviving anywhere in the output (a signed answer,
// a git config example) would undo the pseudonyms.
export function assertNoLearnerHandles(output: string, emails: string[]): void {
  for (const handle of handlesOf(emails)) {
    if (handlePattern(handle).test(output)) {
      throw new Error(`A learner handle (${handle.slice(0, 2)}…) survives in the export; redact it before committing.`);
    }
  }
}
