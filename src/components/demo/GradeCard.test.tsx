// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GradeCard } from "./GradeCard";

const setup = (note = "") => {
  const onChange = vi.fn();
  const onActivity = vi.fn();
  render(<GradeCard learner="learner-03" answer="arr.pop()" value={{ verdict: null, note }} onChange={onChange} onActivity={onActivity} />);
  return { onChange, onActivity };
};

describe("GradeCard", () => {
  afterEach(cleanup);

  it("shows the learner and the answer", () => {
    setup();
    expect(screen.getByText("learner-03")).toBeTruthy();
    expect(screen.getByText("arr.pop()")).toBeTruthy();
  });

  it("records a verdict and counts the click as attention", () => {
    const { onChange, onActivity } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onChange).toHaveBeenCalledWith({ verdict: "reject", note: "" });
    expect(onActivity).toHaveBeenCalledWith("attend");
  });

  it("counts each keystroke as typing", () => {
    const { onChange, onActivity } = setup();
    const box = screen.getByLabelText("Note to the learner");
    fireEvent.keyDown(box, { key: "W" });
    fireEvent.change(box, { target: { value: "W" } });
    expect(onActivity).toHaveBeenCalledWith("type");
    expect(onChange).toHaveBeenCalledWith({ verdict: null, note: "W" });
  });

  it("caps the note at 1,000 characters", () => {
    setup();
    expect(screen.getByLabelText("Note to the learner").getAttribute("maxlength")).toBe("1000");
  });
});
