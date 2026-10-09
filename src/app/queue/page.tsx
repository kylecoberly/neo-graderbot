"use client";

import { useEffect, useState } from "react";
import { QueueRowCard } from "@/components/QueueRowCard";
import type { QueueRow, QueueStats } from "@/lib/queue/state";
import { parseEvents } from "@/lib/sse";
import type { Verdict } from "@/lib/types";

type Review = (answerId: string, verdict: Verdict, feedback: string) => Promise<void>;

// Remount a card when its row changes state, so its local editor state starts fresh.
const cardKey = (r: QueueRow) => `${r.answerId}:${r.status}:${r.review ? "reviewed" : ""}`;

export default function Page() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [grading, setGrading] = useState(0);

  useEffect(() => {
    void fetch("/api/queue")
      .then((r) => r.json())
      .then((d: { rows: QueueRow[]; stats: QueueStats }) => {
        setRows(d.rows);
        setStats(d.stats);
      });
  }, []);

  const upsert = (row: QueueRow) =>
    setRows((rs) => (rs.some((r) => r.answerId === row.answerId) ? rs.map((r) => (r.answerId === row.answerId ? row : r)) : [row, ...rs]));

  async function simulate() {
    setGrading((n) => n + 1);
    try {
      const res = await fetch("/api/queue/next", { method: "POST" });
      if (res.status === 204 || !res.body) {
        setStats((s) => (s ? { ...s, remaining: 0 } : s));
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseEvents(buffer + value);
        buffer = parsed.rest;
        for (const e of parsed.events) {
          if (e.event === "row") upsert(e.data as QueueRow);
          if (e.event === "feedback") {
            const { answerId, text } = e.data as { answerId: string; text: string };
            setRows((rs) => rs.map((r) => (r.answerId === answerId ? { ...r, draft: text } : r)));
          }
          if (e.event === "done") {
            const d = e.data as { row: QueueRow; stats: QueueStats };
            upsert(d.row);
            setStats(d.stats);
          }
        }
      }
    } finally {
      setGrading((n) => n - 1);
    }
  }

  const review: Review = async (answerId, verdict, feedback) => {
    const res = await fetch("/api/queue/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerId, verdict, feedback }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    upsert(d.row);
    setStats(d.stats);
  };

  async function reset() {
    const d = (await (await fetch("/api/queue", { method: "DELETE" })).json()) as { rows: QueueRow[]; stats: QueueStats };
    setRows(d.rows);
    setStats(d.stats);
  }

  const incoming = rows.filter((r) => r.status === "grading");
  const recorded = rows.filter((r) => r.status === "recorded");
  const needsYou = rows
    .filter((r) => r.status === "deferred" || r.status === "failed")
    .sort((a, b) => Number(Boolean(a.review)) - Number(Boolean(b.review)));

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Neo GraderBot <span className="text-sm font-normal text-zinc-500">instructor queue</span>
          </h1>
          <p className="text-sm text-zinc-500">A grading assistant for a corporate training cohort. It writes a grade only when its policy says it may.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void simulate()}
            disabled={stats?.remaining === 0}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {grading ? `Simulate incoming (${grading} grading)` : "Simulate incoming"}
          </button>
          <button type="button" onClick={() => void reset()} className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Reset
          </button>
        </div>
      </header>

      {stats && (
        <dl className="mt-4 flex flex-wrap gap-6 text-sm">
          <Stat label="Recorded by the agent" value={stats.recorded} />
          <Stat label="Needs you" value={stats.needsYou} />
          <Stat label="Spot-check agreement" value={stats.spotChecked ? `${stats.agreed}/${stats.spotChecked}` : "–"} />
          <Stat label="Left to arrive" value={stats.remaining} />
        </dl>
      )}

      {incoming.length > 0 && (
        <section className="mt-6 grid gap-3 md:grid-cols-2">
          {incoming.map((r) => (
            <QueueRowCard key={cardKey(r)} row={r} onReview={async () => {}} />
          ))}
        </section>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Column title="Recorded" hint="The agent wrote these grades itself. Spot-check any of them." rows={recorded} review={review} />
        <Column title="Needs you" hint="The policy stopped these, and each says why." rows={needsYou} review={review} />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Column({ title, hint, rows, review }: { title: string; hint: string; rows: QueueRow[]; review: Review }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">
        {title} <span className="text-zinc-400">{rows.length}</span>
      </h2>
      <p className="mb-3 text-xs text-zinc-500">{hint}</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <QueueRowCard key={cardKey(r)} row={r} onReview={(v, f) => review(r.answerId, v, f)} />
        ))}
      </div>
    </section>
  );
}
