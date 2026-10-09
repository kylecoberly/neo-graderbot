import { describe, expect, it } from "vitest";
import { decodeField, parseCopyBlocks, records } from "./pgcopy";

describe("decodeField", () => {
  it("reads \\N as NULL", () => expect(decodeField("\\N")).toBeNull());
  it("decodes escapes in one pass", () => {
    expect(decodeField("a\\tb\\nc")).toBe("a\tb\nc");
    // A JSON string's "\n" is written as \\n by COPY and must come back as backslash-n.
    expect(decodeField('{"x": "1\\\\n2"}')).toBe('{"x": "1\\n2"}');
    expect(JSON.parse(decodeField('{"x": "1\\\\n2"}')!).x).toBe("1\n2");
  });
  it("decodes octal and hex escapes", () => {
    expect(decodeField("\\101\\x42")).toBe("AB");
  });
});

describe("parseCopyBlocks", () => {
  const sql = [
    "SET client_encoding = 'UTF8';",
    'COPY public.evaluation (id, "createdAt", feedback, status) FROM stdin;',
    "1\t2022-03-01 10:00:00+00\tClose!\\nTry again\trejected",
    "2\t2022-03-02 10:00:00+00\t\\N\taccepted",
    "\\.",
    "",
    "COPY public.knex_migrations_lock (index, is_locked) FROM stdin;",
    "1\t0",
    "\\.",
  ].join("\n");

  it("finds every block with unquoted column names", () => {
    const tables = parseCopyBlocks(sql);
    expect([...tables.keys()]).toEqual(["evaluation", "knex_migrations_lock"]);
    expect(tables.get("evaluation")!.columns).toEqual(["id", "createdAt", "feedback", "status"]);
  });

  it("turns rows into records", () => {
    const rows = records(parseCopyBlocks(sql).get("evaluation")!);
    expect(rows).toEqual([
      { id: "1", createdAt: "2022-03-01 10:00:00+00", feedback: "Close!\nTry again", status: "rejected" },
      { id: "2", createdAt: "2022-03-02 10:00:00+00", feedback: null, status: "accepted" },
    ]);
  });
});
