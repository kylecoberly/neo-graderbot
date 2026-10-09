// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Summary as SummaryData } from "@/lib/demo/results";
import { Summary } from "./Summary";

const base: SummaryData = {
  settled: true,
  rows: {},
  agreement: { agree: 6, compared: 8 },
  richness: { visitor: 9, agent: 20 },
  keyMatch: null,
  judgeTally: null,
  efficiency: { byHandMs: 120_000, withAgentMs: 45_000, medianMs: 15_000, deferred: 2, recorded: 6, agentWallMs: 6000 },
  speed: { kind: "graded", n: 8, m: 40 },
};

describe("Summary", () => {
  afterEach(cleanup);

  it("leads with the speed line", () => {
    render(<Summary summary={base} judgeSummary={null} pending={0} />);
    expect(screen.getByText("In the time it took you to grade 8 responses, GraderBot could have graded 40.")).toBeTruthy();
    expect(screen.getByText(/agreed on 6 of 8/)).toBeTruthy();
  });

  it("waits for GraderBot before totalling", () => {
    render(<Summary summary={{ ...base, settled: false, efficiency: null, speed: null }} judgeSummary={null} pending={3} />);
    expect(screen.getByText("Waiting for GraderBot on 3 answers…")).toBeTruthy();
    expect(screen.queryByText(/In the time it took you/)).toBeNull();
  });

  it("compares with the answer key only when there is one", () => {
    render(<Summary summary={base} judgeSummary={null} pending={0} />);
    expect(screen.queryByText(/intended verdict/)).toBeNull();
    cleanup();
    render(<Summary summary={{ ...base, keyMatch: { agree: 7, compared: 8 } }} judgeSummary={null} pending={0} />);
    expect(screen.getByText(/GraderBot matched the intended verdict on 7 of 8/)).toBeTruthy();
  });
});
