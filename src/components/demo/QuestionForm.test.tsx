// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionForm, SAMPLE_QUESTIONS } from "./QuestionForm";

describe("QuestionForm", () => {
  afterEach(cleanup);

  it("fills the box from a sample", () => {
    render(<QuestionForm onSubmit={() => {}} busy={false} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: SAMPLE_QUESTIONS[0] }));
    expect((screen.getByLabelText(/short-answer question/) as HTMLTextAreaElement).value).toBe(SAMPLE_QUESTIONS[0]);
  });

  it("submits the trimmed question", () => {
    const onSubmit = vi.fn();
    render(<QuestionForm onSubmit={onSubmit} busy={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/short-answer question/), { target: { value: "  What is a branch?  " } });
    fireEvent.click(screen.getByRole("button", { name: "Write the answers" }));
    expect(onSubmit).toHaveBeenCalledWith("What is a branch?");
  });

  it("caps the length, waits while busy, and shows the error", () => {
    render(<QuestionForm onSubmit={() => {}} busy={true} error="Ask one question at a time." initial="x" />);
    expect(screen.getByLabelText(/short-answer question/).getAttribute("maxlength")).toBe("300");
    expect((screen.getByRole("button", { name: "Write the answers" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Ask one question at a time.");
  });
});
