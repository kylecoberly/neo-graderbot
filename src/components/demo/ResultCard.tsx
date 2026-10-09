import { REASONS } from "@/lib/agent/reasons";
import { WHO, type AgentState, type Entry, type JudgeRow, type Row, type VisitorGrade } from "@/lib/demo/results";
import type { Richness } from "@/lib/demo/richness";
import { Prose, VerdictBadge } from "../ui";

const CRITERIA: [keyof Richness, string][] = [
  ["specific", "names something in the answer"],
  ["grounded", "uses the lesson's terms"],
  ["nudges", "leaves the learner something to do"],
  ["safe", "doesn't give the answer away"],
];

// The column template every results row and the header share: the grading
// row's columns, with GraderBot's verdict and note beside yours.
export const RESULT_COLUMNS = (withVisitor: boolean) =>
  withVisitor ? "md:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" : "md:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1.4fr)]";

export function ResultHeader({ withVisitor }: { withVisitor: boolean }) {
  const columns = withVisitor ? ["Learner", "Answer", "You", "GraderBot"] : ["Learner", "Answer", "GraderBot"];
  return (
    <div className={`hidden gap-4 border-b border-line px-4 py-2 md:grid ${RESULT_COLUMNS(withVisitor)}`}>
      {columns.map((h) => (
        <p key={h} className={`eyebrow ${h === "GraderBot" ? "text-accent" : ""}`}>
          {h}
        </p>
      ))}
    </div>
  );
}

// Four dots, one per criterion a note can meet; the title spells them out.
function RichnessDots({ r }: { r: Richness | null }) {
  if (!r) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted" title={CRITERIA.map(([k, label]) => `${r[k] ? "✓" : "✗"} ${label}`).join("\n")}>
      <span className="flex gap-0.5" aria-hidden>
        {CRITERIA.map(([k]) => (
          <span key={k} className={`h-2 w-2 rounded-full ${r[k] ? "bg-accent" : "bg-line"}`} />
        ))}
      </span>
      {`Feedback richness ${r.score}/4`}
    </p>
  );
}

export function ResultCard({ entry, grade, agent, row, judge }: { entry: Entry; grade: VisitorGrade | null; agent: AgentState; row: Row; judge: JudgeRow | null }) {
  const result = agent.status === "done" ? agent.result : null;
  const decision = result?.decision;
  const deferred = decision?.action === "defer";
  const tint = row.agree === false ? "bg-reject-soft/40" : deferred ? "bg-warn-soft/50" : "";
  return (
    <article className={`grid gap-3 px-4 py-4 md:gap-4 ${RESULT_COLUMNS(grade !== null)} ${tint}`}>
      <div className="md:pt-1">
        <p className="eyebrow">{entry.learner}</p>
        {row.agree === false && <span className="mt-1 inline-block rounded-md bg-reject px-1.5 py-0.5 text-[11px] font-semibold text-paper">Disagree</span>}
        {deferred && row.agree !== false && <span className="mt-1 inline-block rounded-md bg-warn px-1.5 py-0.5 text-[11px] font-semibold text-paper">Deferred</span>}
      </div>
      <div className="min-w-0">
        <Prose text={entry.answer} className="text-[15px]" />
        {entry.intended && (
          <p className="mt-2 text-xs text-muted">
            {`Written to be ${entry.intended === "accept" ? "accepted" : "rejected"} (${entry.kind?.replace(/_/g, " ")})`}
            {row.keyAgrees !== null && (row.keyAgrees ? " · GraderBot matched it" : " · GraderBot did not")}
          </p>
        )}
      </div>
      {grade && (
        <div className="min-w-0">
          <VerdictBadge verdict={grade.verdict} />
          {grade.note && <p className="mt-2 text-sm [overflow-wrap:anywhere]">{grade.note}</p>}
          <RichnessDots r={row.visitorRichness} />
        </div>
      )}
      <div className="min-w-0">
        {agent.status === "pending" && (
          <>
            <p className="text-xs text-muted">grading…</p>
            {agent.draft && <p className="mt-2 text-sm text-muted">{agent.draft}</p>}
          </>
        )}
        {agent.status === "error" && <p className="text-sm text-muted">{agent.message === "expired" ? "This page expired before GraderBot finished." : agent.message}</p>}
        {decision && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={decision.verdict} />
              {result?.certainty && <span className="text-xs text-muted">{`${result.certainty} certainty`}</span>}
            </div>
            {decision.feedback && <p className="mt-2 text-sm [overflow-wrap:anywhere]">{decision.feedback}</p>}
            <RichnessDots r={row.agentRichness} />
            <p className={`mt-2 text-xs ${deferred ? "text-warn" : "text-accent"}`}>
              {deferred ? `Flagged for you: ${REASONS[decision.reason] ?? decision.reason}.` : "Filed: ready for your approval."}
            </p>
            {result?.basis && (
              <blockquote className="mt-2 border-l-2 border-line pl-2 text-xs text-muted">
                <Prose text={result.basis} className="line-clamp-3" />
              </blockquote>
            )}
            {result && !result.live && <p className="mt-1 text-xs text-warn">Graded earlier: live grading is unavailable right now.</p>}
          </>
        )}
        {judge && (
          <div className="mt-3 rounded-lg bg-paper/80 px-3 py-2 text-sm">
            <p className="eyebrow">
              Judge <span className="normal-case tracking-normal text-muted">{`· better verdict: ${WHO[judge.better_verdict] ?? "…"} · better note: ${WHO[judge.better_note] ?? "…"}`}</span>
            </p>
            {judge.comment && <p className="mt-1">{judge.comment}</p>}
          </div>
        )}
      </div>
    </article>
  );
}
