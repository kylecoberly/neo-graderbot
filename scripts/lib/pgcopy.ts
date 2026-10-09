export interface CopyTable {
  columns: string[];
  rows: (string | null)[][];
}

const ESCAPES: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\" };

// PostgreSQL's COPY text format. Decoding must be a single pass: "\\n" is a
// backslash followed by n (how a JSON payload's own "\n" escape is stored),
// and decoding twice would turn it into a newline and break JSON.parse.
export function decodeField(raw: string): string | null {
  if (raw === "\\N") return null;
  return raw.replace(/\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (_, code: string) => {
    if (code[0] === "x") return String.fromCharCode(parseInt(code.slice(1), 16));
    if (/^[0-7]/.test(code)) return String.fromCharCode(parseInt(code, 8));
    return ESCAPES[code] ?? code;
  });
}

export function parseCopyBlocks(sql: string): Map<string, CopyTable> {
  const tables = new Map<string, CopyTable>();
  const lines = sql.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const header = /^COPY public\.(\w+) \((.+)\) FROM stdin;$/.exec(lines[i]);
    if (!header) continue;
    const columns = header[2].split(", ").map((c) => c.replace(/^"|"$/g, ""));
    const rows: (string | null)[][] = [];
    for (i += 1; i < lines.length && lines[i] !== "\\."; i++) {
      rows.push(lines[i].split("\t").map(decodeField));
    }
    tables.set(header[1], { columns, rows });
  }
  return tables;
}

export function records(table: CopyTable): Record<string, string | null>[] {
  return table.rows.map((row) => Object.fromEntries(table.columns.map((c, i) => [c, row[i] ?? null])));
}
