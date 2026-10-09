"use client";

import { Textarea } from "./Textarea";
import { useState } from "react";
import type { QueueRow } from "@/lib/queue/state";
import { REASONS } from "@/lib/agent/reasons";
import { TOPICS } from "@/lib/topics";
import type { Verdict } from "@/lib/types";


const UPLOAD: Record<string, string> = {
  uploaded: "saved to neo-graderbot-overrides",
  skipped: "not uploaded (no LangSmith key)",
  failed: "upload to LangSmith failed",
};

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const tone = verdict === "accept" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone}`}>{verdict === "accept" ? "Accept" : "Reject"}</span>;
}

const button = "rounded border px-3 py-1 text-sm disabled:opacity-50";

export function QueueRowCard({ row, onReview }: { row: QueueRow; onReview: (verdict: Verdict, feedback: string) => Promise<void> }) {
  const recorded = row.decision?.action === "record" ? row.decision : null;
  const [editing, setEditing] = useState(row.status === "deferred" || row.status === "failed");
  const [verdict, setVerdict] = useState<Verdict>(row.decision?.verdict ?? row.judgment?.verdict ?? "reject");
  const [feedback, setFeedback] = useState(row.decision?.feedback ?? row.judgment?.feedback ?? "");
  const [saving, setSaving] = useState(false);

  async function save(v: Verdict, f: string) {
    setSaving(true);
    try {
      await onReview(v, f);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="flex items-baseline justify-between gap-2 text-xs text-zinc-500">
        <span>
          {row.learner} · {TOPICS[row.slice].label}
        </span>
        {row.runId && row.status !== "grading" && (
          <a className="underline hover:text-zinc-800" href={`/api/trace/${row.runId}`} target="_blank" rel="noreferrer">
            trace
          </a>
        )}
      </header>
      <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-zinc-800">{row.prompt.replace(/\*\*/g, "").trim()}</p>
      <blockquote className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 font-mono text-sm text-zinc-700">
        {row.answer || "(empty)"}
      </blockquote>

      {row.status === "grading" && <p className="mt-3 text-sm italic text-zinc-500">{row.draft || "Grading…"}</p>}
      {row.status === "failed" && <p className="mt-3 text-sm text-red-700">Grading failed: {row.error}</p>}
      {row.decision?.action === "defer" && (
        <p className="mt-3 text-sm font-medium text-amber-700">{REASONS[row.decision.reason] ?? row.decision.reason}</p>
      )}
      {recorded && !editing && (
        <div className="mt-3 flex items-start gap-2 text-sm">
          <VerdictBadge verdict={recorded.verdict} />
          <span>{recorded.feedback}</span>
        </div>
      )}

      {row.review && !editing && (
        <p className="mt-2 text-sm text-zinc-600">
          You: <VerdictBadge verdict={row.review.verdict} /> {row.review.feedback}
          {row.review.agreed !== null && <span> · {row.review.agreed ? "agreed with the agent" : "overrode the agent"}</span>}
          <span className="text-xs text-zinc-400"> · {UPLOAD[row.review.override]}</span>
        </p>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            {(["accept", "reject"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={verdict === v}
                onClick={() => setVerdict(v)}
                className={`${button} ${verdict === v ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}
              >
                {v === "accept" ? "Accept" : "Reject"}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Feedback to the learner"
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <button type="button" disabled={saving || !feedback.trim()} onClick={() => void save(verdict, feedback)} className={`${button} border-red-600 bg-red-600 text-white`}>
            Save
          </button>
        </div>
      )}

      {recorded && !row.review && !editing && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={saving} onClick={() => void save(recorded.verdict, recorded.feedback)} className={`${button} border-zinc-300`}>
            Agree
          </button>
          <button type="button" onClick={() => setEditing(true)} className={`${button} border-zinc-300`}>
            Override
          </button>
        </div>
      )}

      {row.status !== "grading" && (
        <details className="mt-3 text-xs text-zinc-600">
          <summary className="cursor-pointer select-none">Why?</summary>
          <dl className="mt-2 space-y-2">
            {row.judgment && (
              <div>
                <dt className="font-semibold">Certainty</dt>
                <dd>{row.judgment.certainty}</dd>
              </div>
            )}
            {row.judgment?.basis && (
              <div>
                <dt className="font-semibold">Basis</dt>
                <dd className="italic">“{row.judgment.basis}”</dd>
              </div>
            )}
            {row.passages.length > 0 && (
              <div>
                <dt className="font-semibold">Retrieved</dt>
                <dd>{row.passages.map((p) => `${p.lesson} › ${p.heading}`).join(" · ")}</dd>
              </div>
            )}
            {row.checks.length > 0 && (
              <div>
                <dt className="font-semibold">Policy</dt>
                <dd>
                  <ul>
                    {row.checks.map((c) => (
                      <li key={c.name}>
                        {c.passed ? "✓" : "✗"} {c.name} <span className="text-zinc-400">({c.detail})</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            <div>
              <dt className="font-semibold">What the instructor decided in 2022</dt>
              <dd>
                <VerdictBadge verdict={row.archive.verdict} /> {row.archive.feedback ?? ""}
              </dd>
            </div>
          </dl>
        </details>
      )}
    </article>
  );
}
