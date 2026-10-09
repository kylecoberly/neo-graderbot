import { LinkButton } from "@/components/ui";
import { loadGradingHours } from "@/lib/data";
import { recordedMode } from "@/lib/demo/recorded";

const n = (x: number) => x.toLocaleString("en-US");

export default function Landing() {
  const h = loadGradingHours();
  const stats: [string, string][] = [
    [n(h.shortAnswers), "short answers I graded by hand in 2022"],
    [`${Math.round(h.shortAnswerMinutes / 60)} h`, "of grading, 7 months of a 21-person cohort"],
    [`${Math.round((h.shortAnswerMinutes * 60) / h.shortAnswers)} s`, "per answer, feedback included"],
  ];
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="eyebrow">A grading assistant for software engineering teachers</p>
      <h1 className="mt-3 text-5xl leading-[1.05]">Fast, individualized feedback, with the teacher still in the loop.</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">
        Neo GraderBot grades short-answer questions against the lesson, writes the feedback the learner reads, and defers to the teacher
        with its reasoning when it isn&apos;t sure. Every grade goes to the teacher&apos;s queue for approval; the flagged ones are where
        your attention goes.
      </p>
      <dl className="mt-10 grid grid-cols-3 gap-4 border-y border-line py-6">
        {stats.map(([value, label]) => (
          <div key={label}>
            <dt className="font-display text-3xl">{value}</dt>
            <dd className="mt-1 text-sm text-muted">{label}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 leading-relaxed">
        Try it the way I did it: grade a page of real student responses while GraderBot grades the same page, then compare your scores and
        feedback with its{recordedMode() ? " and see which answers it flagged for you." : ", see which answers it flagged for you, and let an independent judge weigh in on both of you."}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <LinkButton href="/grade">Grade a page</LinkButton>
        <span className="text-sm text-muted">Eight responses, a few minutes. Real students from 2022, pseudonymized.</span>
      </div>
    </main>
  );
}
