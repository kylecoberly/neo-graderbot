import { describe, expect, it } from "vitest";
import { encodeEvent, parseEvents } from "./sse";

describe("sse", () => {
  it("round-trips events and keeps a partial tail", () => {
    const wire = encodeEvent("row", { a: 1 }) + encodeEvent("feedback", { text: "Close\nbut" }) + "event: done\ndata: {\"x\"";
    const { events, rest } = parseEvents(wire);
    expect(events).toEqual([
      { event: "row", data: { a: 1 } },
      { event: "feedback", data: { text: "Close\nbut" } },
    ]);
    expect(rest).toBe('event: done\ndata: {"x"');
  });
});
