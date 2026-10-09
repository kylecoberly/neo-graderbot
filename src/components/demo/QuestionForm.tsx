"use client";

import { useState } from "react";
import { QUESTION_MAX_CHARS } from "@/lib/demo/limits";
import { Textarea } from "../Textarea";
import { Button } from "../ui";

export const SAMPLE_QUESTIONS = [
  "What does `git status` show you?",
  "What's the difference between `let` and `const` in JavaScript?",
  "What does `>` do in a shell command?",
];

export function QuestionForm({ onSubmit, busy, error, initial = "" }: { onSubmit: (q: string) => void; busy: boolean; error: string | null; initial?: string }) {
  const [question, setQuestion] = useState(initial);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(question.trim());
      }}
    >
      <label className="block text-sm font-medium" htmlFor="own-question">
        Ask a short-answer question a course might ask
      </label>
      <Textarea
        id="own-question"
        className="min-h-24 text-base"
        rows={3}
        maxLength={QUESTION_MAX_CHARS}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {SAMPLE_QUESTIONS.map((q) => (
          <button key={q} type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-muted hover:text-ink" onClick={() => setQuestion(q)}>
            {q}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-reject">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !question.trim()}>
        Write the answers
      </Button>
    </form>
  );
}
