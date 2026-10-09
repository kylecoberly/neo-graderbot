"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gradeItem, post, runJudge } from "@/lib/demo/client";
import { median } from "@/lib/demo/efficiency";
import { canSubmit, feedbackPayload, receiptOf, summarise, type AgentState, type Entry, type JudgeRow, type VisitorGrade } from "@/lib/demo/results";
import { addEvent, emptyTiming, finish, type Timing } from "@/lib/demo/timing";
import { Button, Prose } from "../ui";
import { GradeCard, GradeHeader } from "./GradeCard";
import { ResultCard, ResultHeader } from "./ResultCard";
import { Summary } from "./Summary";

export interface SessionQuestion { prompt: string; reference: string | null; vocabulary: string[]; lessons?: string[]; label?: string }

// Markdown emphasis in the archive's prompts reads as noise in plain text.
const plain = (s: string) => s.replace(/\*\*/g, "");

export function GradingSession(props: {
  entries: Entry[];
  question: SessionQuestion;
  token: string;
  mode: "grade" | "skip";
  priorMedianMs: number | null;
  onFinished?: (medianActiveMs: number) => void;
  onExpired: () => void;
  after?: ReactNode;
}) {
  const { entries, question, token, mode } = props;
  const keys = entries.map((e) => e.key);
  const [grades, setGrades] = useState<Record<string, VisitorGrade>>(() => Object.fromEntries(keys.map((k) => [k, { verdict: null, note: "" }])));
  const [timing, setTiming] = useState<Timing>(emptyTiming);
  const [agent, setAgent] = useState<Record<string, AgentState>>(() => Object.fromEntries(keys.map((k) => [k, { status: "pending", draft: "" }])));
  const [phase, setPhase] = useState<"grading" | "results">(mode === "skip" ? "results" : "grading");
  const [judge, setJudge] = useState<{ rows: JudgeRow[]; summary: string } | null>(null);
  const [judgeFailed, setJudgeFailed] = useState(false);
  const started = useRef<string | null>(null);
  const judged = useRef(false);
  const labelled = useRef(false);

  // The agent starts as soon as the page loads, so its grades are ready when
  // the visitor is. Its results stay hidden until they submit.
  useEffect(() => {
    if (started.current === token) return;
    started.current = token;
    for (const e of entries) {
      void gradeItem(token, e.key, (draft) => setAgent((a) => ({ ...a, [e.key]: { status: "pending", draft } }))).then((state) =>
        setAgent((a) => ({ ...a, [e.key]: state })),
      );
    }
  }, [entries, token]);

  const expired = Object.values(agent).some((a) => a.status === "error" && a.message === "expired");
  const { onExpired } = props;
  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  const summary = summarise({
    entries,
    grades: mode === "grade" ? grades : null,
    agent,
    timing: mode === "grade" && phase === "results" ? timing : null,
    priorMedianMs: props.priorMedianMs,
    reference: question.reference,
    vocabulary: question.vocabulary,
    judge: judge?.rows ?? null,
  });

  useEffect(() => {
    if (mode !== "grade" || phase !== "results" || !summary.settled || judged.current) return;
    judged.current = true;
    const items = entries.map((e) => ({
      key: e.key,
      receipt: receiptOf(agent[e.key]) ?? undefined,
      visitor: { verdict: grades[e.key].verdict, note: grades[e.key].note },
    }));
    void runJudge(token, items, (rows, s) => setJudge({ rows, summary: s })).then((final) => {
      // Past the ticket's two hours the receipts have expired too, so there
      // is nothing to label; say so rather than blame the judge.
      if (final === "expired") return onExpired();
      if (final) setJudge(final);
      else setJudgeFailed(true);
    });
  }, [mode, phase, summary.settled, entries, agent, grades, token, onExpired]);

  // Once per page, as soon as every answer has settled (not after the judge,
  // which a visitor may not wait for): the visitor's verdicts become feedback
  // on the agent's traces. Fire and forget; the page doesn't depend on it.
  useEffect(() => {
    if (mode !== "grade" || phase !== "results" || !summary.settled || labelled.current) return;
    labelled.current = true;
    const payload = feedbackPayload(entries, agent, grades);
    if (payload.verdicts.length) void post("/api/demo/feedback", payload).catch(() => {});
  }, [mode, phase, summary.settled, entries, agent, grades]);

  const activity = (key: string) => (kind: "attend" | "type") => setTiming((t) => addEvent(t, { t: performance.now(), key, kind }));

  function submit() {
    const closed = finish(timing, performance.now());
    setTiming(closed);
    setPhase("results");
    props.onFinished?.(median(keys.map((k) => closed.activeMs[k] ?? 0).filter((ms) => ms > 0)));
  }

  const pending = Object.values(agent).filter((a) => a.status === "pending").length;
  return (
    <div className="space-y-6">
      <section className="card">
        {question.label && <p className="eyebrow">{question.label}</p>}
        <Prose text={plain(question.prompt)} className="mt-1 font-display text-xl" />
        {question.reference && (
          <div className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">
            <p className="eyebrow">Reference answer</p>
            <Prose text={question.reference} className="mt-1" />
          </div>
        )}
        {question.lessons && question.lessons.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            {"Lessons: "}
            {question.lessons.map((l, i) => (
              <span key={l}>
                <a className="underline" href={`/lesson/${l}`} target="_blank" rel="noreferrer">
                  {l}
                </a>
                {i < question.lessons!.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}
      </section>

      {phase === "grading" ? (
        <>
          <p className="text-sm text-muted">Accept or reject each answer, and leave a note where it would help the learner. GraderBot is grading the same answers now.</p>
          <div className="card divide-y divide-line p-0">
            <GradeHeader />
            {entries.map((e) => (
              <GradeCard
                key={e.key}
                learner={e.learner}
                answer={e.answer}
                value={grades[e.key]}
                onChange={(v) => setGrades((g) => ({ ...g, [e.key]: v }))}
                onActivity={activity(e.key)}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button disabled={!canSubmit(grades, keys)} onClick={submit}>
              Submit page
            </Button>
          </div>
        </>
      ) : (
        <>
          <Summary summary={summary} judgeSummary={judge?.summary || null} pending={pending} />
          {judgeFailed && <p className="text-sm text-muted">The judge is unavailable right now.</p>}
          <div className="card divide-y divide-line p-0">
            <ResultHeader withVisitor={mode === "grade"} />
            {entries.map((e) => (
              <ResultCard
                key={e.key}
                entry={e}
                grade={mode === "grade" ? grades[e.key] : null}
                agent={agent[e.key]}
                row={summary.rows[e.key]}
                judge={judge?.rows.find((r) => r.key === e.key) ?? null}
              />
            ))}
          </div>
          {props.after}
        </>
      )}
    </div>
  );
}
