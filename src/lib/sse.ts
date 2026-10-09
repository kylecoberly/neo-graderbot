export function encodeEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// JSON.stringify never emits a raw newline, so every event is exactly one
// event line and one data line; anything after the last blank line is an
// event still arriving.
export function parseEvents(buffer: string): { events: { event: string; data: unknown }[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events = blocks
    .filter((b) => b.trim())
    .map((block) => {
      let event = "message";
      let data = "null";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data = line.slice(6);
      }
      return { event, data: JSON.parse(data) as unknown };
    });
  return { events, rest };
}
