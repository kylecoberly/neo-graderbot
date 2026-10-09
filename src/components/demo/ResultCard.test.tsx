// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultCard } from "./ResultCard";

const row = { agree: null, visitorRichness: null, agentRichness: null, keyAgrees: null };

describe("ResultCard", () => {
  afterEach(cleanup);

  it("says the page expired instead of showing the error code", () => {
    render(<ResultCard entry={{ key: "a", learner: null, answer: "x" }} grade={null} agent={{ status: "error", message: "expired" }} row={row} judge={null} />);
    expect(screen.getByText("This page expired before GraderBot finished.")).toBeTruthy();
    expect(screen.queryByText("expired")).toBeNull();
  });
});
