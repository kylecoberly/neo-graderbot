const STOP = new Set(
  "a an and are as at be by can do does for from has have how i if in into is it its of on or that the their them then there these this to was what when which why will with you your".split(
    " ",
  ),
);

// Backticked code is kept whole as well as split into words, so a question
// about `..` or `~` can match the passage that explains it.
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const code = [...lower.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
  const words = (lower.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? []).filter((w) => !STOP.has(w));
  return [...code, ...words];
}

interface Doc<T> {
  item: T;
  tf: Map<string, number>;
  len: number;
}

export class Bm25<T> {
  private readonly docs: Doc<T>[];
  private readonly df = new Map<string, number>();
  private readonly avgLen: number;
  private readonly k1 = 1.2;
  private readonly b = 0.75;

  constructor(items: T[], text: (item: T) => string) {
    this.docs = items.map((item) => {
      const tokens = tokenize(text(item));
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { item, tf, len: tokens.length };
    });
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((sum, d) => sum + d.len, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, k: number): { item: T; score: number }[] {
    const terms = [...new Set(tokenize(query))];
    const n = this.docs.length;
    return this.docs
      .map((d) => ({
        item: d.item,
        score: terms.reduce((sum, t) => {
          const f = d.tf.get(t);
          if (!f) return sum;
          const df = this.df.get(t)!;
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
          return sum + idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen)));
        }, 0),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
