"use client";

import { useCallback, useState } from "react";
import { GradingSession, type SessionQuestion } from "@/components/demo/GradingSession";
import { QuestionForm } from "@/components/demo/QuestionForm";
import { Button, LinkButton, Prose } from "@/components/ui";
import { PACE_KEY, post, readStream } from "@/lib/demo/client";
import { recordedMode } from "@/lib/demo/recorded";
import type { Entry } from "@/lib/demo/results";

interface Exercise { token: string; question: SessionQuestion; entries: Entry[] }
type Phase =
  | { name: "ask"; error: string | null; question: string }
  | { name: "writing"; written: number | null; question: string }
  | { name: "choose"; exercise: Exercise }
  | { name: "session"; exercise: Exercise; mode: "grade" | "skip" };

const UNAVAILABLE = "Live generation is unavailable right now.";

export default function TryPage() {
  const [phase, setPhase] = useState<Phase>({ name: "ask", error: null, question: "" });
  const [expired, setExpired] = useState(false);
  const onExpired = useCallback(() => setExpired(true), []);

  async function generate(question: string) {
    setPhase({ name: "writing", written: null, question });
    const back = (error: string) => setPhase({ name: "ask", error, question });
    let ended = false;
    try {
      const res = await post("/api/try/generate", { question });
      if (res.status === 400) return back(((await res.json()) as { error: string }).error);
      if (!res.ok || !res.body) return back(UNAVAILABLE);
      await readStream(res, (e) => {
        if (e.event === "progress") setPhase({ name: "writing", written: (e.data as { written: number }).written, question });
        if (e.event === "unfit") back((e.data as { reason: string }).reason);
        if (e.event === "error") back((e.data as { message: string }).message);
        if (e.event === "done") setPhase({ name: "choose", exercise: e.data as Exercise });
        ended ||= ["unfit", "error", "done"].includes(e.event);
        return ended;
      });
    } catch {
      // A dropped connection must not leave the page at "Writing answers…".
    }
    if (!ended) back(UNAVAILABLE);
  }

  const prior = typeof window === "undefined" ? null : Number(sessionStorage.getItem(PACE_KEY)) || null;

  // A bookmarked /try still lands somewhere sensible when the link is hidden.
  if (recordedMode()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl">Try your own</h1>
        <p className="mt-4 leading-relaxed text-muted">
          Writing and grading answers to your own question needs live model calls, and those are off while this demo shows recorded
          examples.
        </p>
        <div className="mt-6">
          <LinkButton href="/grade">Grade a page instead</LinkButton>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-3xl">Try your own question</h1>
      <p className="mb-6 max-w-2xl text-muted">
        GraderBot was tuned on one cohort&apos;s questions. Ask one of your own: a model writes the ideal answer and eight learner answers to a plan
        (some meant to pass, some to fail in particular ways), and GraderBot grades them against that ideal answer.
      </p>

      {phase.name === "ask" && <QuestionForm key={phase.question} onSubmit={(q) => void generate(q)} busy={false} error={phase.error} initial={phase.question} />}

      {phase.name === "writing" && (
        <p className="text-muted">{phase.written === null ? "Checking your question…" : `Writing answers… ${Math.min(phase.written, 8)} of 8`}</p>
      )}

      {phase.name === "choose" && (
        <section className="space-y-4">
          <div className="card">
            <Prose text={phase.exercise.question.prompt} className="font-display text-xl" />
            <div className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm">
              <p className="eyebrow">Ideal answer (generated)</p>
              <Prose text={phase.exercise.question.reference ?? ""} className="mt-1" />
            </div>
          </div>
          <p className="text-sm text-muted">Eight answers were written to a plan: some to pass, some to fail in particular ways. You&apos;ll see which after grading.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setPhase({ name: "session", exercise: phase.exercise, mode: "grade" })}>Grade them yourself</Button>
            <Button variant="secondary" onClick={() => setPhase({ name: "session", exercise: phase.exercise, mode: "skip" })}>
              Skip to GraderBot&apos;s grades
            </Button>
          </div>
        </section>
      )}

      {phase.name === "session" && (
        <>
          {expired && <p className="mb-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">This exercise expired. Ask the question again to get a new one.</p>}
          <GradingSession
            key={phase.exercise.token}
            entries={phase.exercise.entries}
            question={phase.exercise.question}
            token={phase.exercise.token}
            mode={phase.mode}
            priorMedianMs={prior}
            onExpired={onExpired}
            after={
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setPhase({ name: "ask", error: null, question: "" })}>Try another question</Button>
                <LinkButton variant="secondary" href="/grade">
                  Grade an archive page
                </LinkButton>
              </div>
            }
          />
        </>
      )}
    </main>
  );
}
