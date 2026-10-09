"use client";

import { useRef } from "react";
import { NOTE_MAX_CHARS } from "@/lib/demo/limits";
import type { VisitorGrade } from "@/lib/demo/results";
import { Textarea } from "../Textarea";
import { Prose } from "../ui";

const MOVE_EVERY_MS = 1000;

// The column template every grading row and the header share. The 2022
// evaluator laid a page out the same way: learner, answer, note, verdict.
export const GRADE_COLUMNS = "md:grid-cols-[6.5rem_minmax(0,1fr)_18rem_9.5rem]";

export function GradeHeader() {
  return (
    <div className={`hidden gap-4 border-b border-line px-4 py-2 md:grid ${GRADE_COLUMNS}`}>
      {["Learner", "Answer", "Note to the learner", "Verdict"].map((h) => (
        <p key={h} className="eyebrow">
          {h}
        </p>
      ))}
    </div>
  );
}

export function GradeCard(props: {
  learner: string | null;
  answer: string;
  value: VisitorGrade;
  onChange: (v: VisitorGrade) => void;
  onActivity: (kind: "attend" | "type") => void;
}) {
  const { value, onChange, onActivity } = props;
  const lastMove = useRef(0);
  const pick = (verdict: "accept" | "reject") => {
    onActivity("attend");
    onChange({ ...value, verdict });
  };
  const tone = (v: "accept" | "reject") =>
    value.verdict === v ? (v === "accept" ? "bg-accept text-paper" : "bg-reject text-paper") : "bg-surface text-muted hover:text-ink";
  return (
    <article
      className={`grid gap-3 px-4 py-4 md:gap-4 ${GRADE_COLUMNS}`}
      onFocusCapture={() => onActivity("attend")}
      onPointerDown={() => onActivity("attend")}
      // Reading is grading too, but a moving pointer fires constantly.
      onPointerMove={(e) => {
        if (e.timeStamp - lastMove.current < MOVE_EVERY_MS) return;
        lastMove.current = e.timeStamp;
        onActivity("attend");
      }}
    >
      <p className="eyebrow md:pt-1">{props.learner}</p>
      <Prose text={props.answer} className="text-[15px]" />
      <Textarea
        aria-label="Note to the learner"
        rows={2}
        maxLength={NOTE_MAX_CHARS}
        placeholder="Optional"
        value={value.note}
        onKeyDown={() => onActivity("type")}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />
      <div className="inline-flex h-9 self-start overflow-hidden rounded-lg border border-line" role="group" aria-label="Verdict">
        <button type="button" aria-pressed={value.verdict === "reject"} className={`px-3 text-sm font-medium transition ${tone("reject")}`} onClick={() => pick("reject")}>
          Reject
        </button>
        <button type="button" aria-pressed={value.verdict === "accept"} className={`border-l border-line px-3 text-sm font-medium transition ${tone("accept")}`} onClick={() => pick("accept")}>
          Accept
        </button>
      </div>
    </article>
  );
}
