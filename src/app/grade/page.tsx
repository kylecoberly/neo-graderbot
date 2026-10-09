"use client";

import { useCallback, useEffect, useState } from "react";
import { GradingSession } from "@/components/demo/GradingSession";
import { Button, LinkButton } from "@/components/ui";
import { PACE_KEY, SEEN_KEY, post } from "@/lib/demo/client";
import type { PublicAnswer, PublicQuestion } from "@/lib/demo/page";
import { DEMO_SLICES, TOPICS } from "@/lib/topics";
import type { Slice } from "@/lib/types";

interface Page { question: PublicQuestion; answers: PublicAnswer[]; token: string }

const CHOICES: { slice: Slice | ""; label: string }[] = [{ slice: "", label: "Any topic" }, ...DEMO_SLICES.map((slice) => ({ slice, label: TOPICS[slice].label }))];

const seen = (): string[] => JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[];

async function fetchPage(slice: Slice | ""): Promise<Page | null> {
  try {
    const res = await post("/api/demo/page", { slice: slice || undefined, exclude: seen() });
    return res.ok ? ((await res.json()) as Page) : null;
  } catch {
    return null;
  }
}

export default function GradePage() {
  const [page, setPage] = useState<Page | null>(null);
  const [slice, setSlice] = useState<Slice | "">("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const apply = useCallback((next: Page | null) => {
    if (!next) {
      setError("Couldn't load a page. Try again in a moment.");
      return;
    }
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen(), next.question.id]));
    setPage(next);
  }, []);

  const load = (s: Slice | "") => {
    setPage(null);
    setError(null);
    setExpired(false);
    void fetchPage(s).then(apply);
  };

  useEffect(() => {
    void fetchPage("").then(apply);
  }, [apply]);

  const onExpired = useCallback(() => setExpired(true), []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl">Grade a page</h1>
        <select
          aria-label="Topic"
          className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-muted"
          value={slice}
          onChange={(e) => {
            const s = e.target.value as Slice | "";
            setSlice(s);
            load(s);
          }}
        >
          {CHOICES.map((t) => (
            <option key={t.label} value={t.slice}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-reject">{error}</p>}
      {expired && (
        <p className="mb-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">
          This page expired.{" "}
          <button type="button" className="underline" onClick={() => load(slice)}>
            Grade a new one
          </button>
        </p>
      )}
      {!page && !error && <p className="text-muted">Drawing a page…</p>}
      {page && (
        <GradingSession
          key={page.token}
          entries={page.answers.map((a) => ({ key: a.id, learner: a.learner, answer: a.answer }))}
          question={page.question}
          token={page.token}
          mode="grade"
          priorMedianMs={null}
          onFinished={(ms) => sessionStorage.setItem(PACE_KEY, String(ms))}
          onExpired={onExpired}
          after={
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => load(slice)}>
                Grade another page
              </Button>
              <LinkButton href="/try">Try your own question →</LinkButton>
            </div>
          }
        />
      )}
    </main>
  );
}
