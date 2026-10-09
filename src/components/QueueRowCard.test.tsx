// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QueueRow } from "@/lib/queue/state";
import { QueueRowCard } from "./QueueRowCard";

const base: QueueRow = {
  answerId: "a-1", questionId: "js-arrays-questions-question-16", slice: "arrays", prompt: "**CLI: `mv`**", learner: "learner-07",
  answer: "moves files", archive: { verdict: "reject", feedback: "There's one other thing it does too!" }, status: "grading",
  draft: "", decision: null, judgment: null, passages: [], checks: [], runId: "run-1", error: null, review: null,
};

afterEach(cleanup);

describe("QueueRowCard", () => {
  it("shows a deferred row's reason and an editor holding the agent's draft", () => {
    render(<QueueRowCard row={{ ...base, status: "deferred", decision: { action: "defer", reason: "certainty", verdict: "reject", feedback: "One more thing" } }} onReview={vi.fn()} />);
    expect(screen.getByText("The agent wasn't sure")).toBeTruthy();
    expect((screen.getByLabelText("Feedback to the learner") as HTMLTextAreaElement).value).toBe("One more thing");
  });

  it("agrees with a recorded grade in one click", () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    render(<QueueRowCard row={{ ...base, status: "recorded", decision: { action: "record", verdict: "accept", feedback: "Yup!" } }} onReview={onReview} />);
    fireEvent.click(screen.getByText("Agree"));
    expect(onReview).toHaveBeenCalledWith("accept", "Yup!");
  });

  it("opens the editor to override a recorded grade", () => {
    render(<QueueRowCard row={{ ...base, status: "recorded", decision: { action: "record", verdict: "accept", feedback: "Yup!" } }} onReview={vi.fn()} />);
    fireEvent.click(screen.getByText("Override"));
    expect(screen.getByLabelText("Feedback to the learner")).toBeTruthy();
  });

  it("shows the streamed draft while grading", () => {
    render(<QueueRowCard row={{ ...base, draft: "There's one" }} onReview={vi.fn()} />);
    expect(screen.getByText("There's one")).toBeTruthy();
  });
});
