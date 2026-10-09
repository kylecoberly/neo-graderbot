import { TOPICS } from "@/lib/topics";
import { SLICES, type Passage, type Question, type Slice } from "@/lib/types";
import { Bm25 } from "./bm25";
import { chunkLesson, type Chunk } from "./chunk";

export type Retriever = (q: Question) => Passage[];

export function makeRetriever(corpus: Record<string, string>, k = 3): Retriever {
  const indexes = new Map<Slice, Bm25<Chunk>>();
  for (const slice of SLICES) {
    const chunks = TOPICS[slice].lessons.flatMap((lesson) => {
      if (!(lesson in corpus)) throw new Error(`The corpus has no lesson "${lesson}" (slice ${slice}); rerun the export.`);
      return chunkLesson(lesson, corpus[lesson]);
    });
    indexes.set(slice, new Bm25(chunks, (c) => `${c.heading}\n${c.text}`));
  }
  return (q) => {
    const index = indexes.get(q.slice as Slice);
    if (!index) return [];
    return index.search(q.prompt, k).map(({ item, score }) => ({ lesson: item.lesson, heading: item.heading, text: item.text, score: +score.toFixed(3) }));
  };
}
