import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EvaluationStore } from "@/lib/agent/store";
import { loadAnswers, loadQuestions, loadSplits } from "@/lib/data";
import type { GradedAnswer, Question } from "@/lib/types";
import { applyDecision, reserveNext, seedState, type QueueRow, type QueueState } from "./state";

export interface QueueStore {
  read(): Promise<QueueState>;
  update(change: (s: QueueState) => QueueState): Promise<QueueState>;
  reset(): Promise<QueueState>;
}

// Every read and write goes through one promise chain, so two gradings that
// finish together cannot overwrite each other's update.
export function createQueueStore(file: string, seed: () => QueueState): QueueStore {
  let chain: Promise<unknown> = Promise.resolve();
  const load = (): QueueState => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as QueueState) : seed());
  const save = (s: QueueState) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(s));
    return s;
  };
  const enqueue = <T>(work: () => T): Promise<T> => {
    const next = chain.then(work);
    chain = next.catch(() => undefined);
    return next;
  };
  return {
    read: () => enqueue(load),
    update: (change) => enqueue(() => save(change(load()))),
    reset: () => enqueue(() => save(seed())),
  };
}

let lookupCache: { answers: Map<string, GradedAnswer>; questions: Map<string, Question> } | null = null;
function lookup() {
  lookupCache ??= {
    answers: new Map(loadAnswers().map((a) => [a.id, a])),
    questions: new Map(loadQuestions().map((q) => [q.id, q])),
  };
  return lookupCache;
}

export function seedFromData(): QueueState {
  const { answers } = lookup();
  return seedState(loadSplits().heldout.map((id) => answers.get(id)!));
}

// Next may load a route's modules more than once in dev; the store lives on
// globalThis so every route shares one write chain.
const g = globalThis as { __graderbotQueue?: QueueStore };

export function queueStore(): QueueStore {
  g.__graderbotQueue ??= createQueueStore(
    process.env.GRADERBOT_QUEUE_FILE ?? join(process.cwd(), "data", ".queue", "state.json"),
    seedFromData,
  );
  return g.__graderbotQueue;
}

export async function reserve(store: QueueStore = queueStore()): Promise<{ row: QueueRow; question: Question } | null> {
  let reserved: { row: QueueRow; question: Question } | null = null;
  await store.update((s) => {
    const next = reserveNext(s, (id) => {
      const answer = lookup().answers.get(id)!;
      return { answer, question: lookup().questions.get(answer.questionId)! };
    });
    if (!next) return s;
    reserved = { row: next.row, question: lookup().questions.get(next.row.questionId)! };
    return next.state;
  });
  return reserved;
}

export function queueEvaluations(store: QueueStore = queueStore()): EvaluationStore {
  return {
    record: async (answerId, e) => {
      await store.update((s) => applyDecision(s, answerId, { action: "record", ...e }));
    },
    defer: async (answerId, d) => {
      await store.update((s) => applyDecision(s, answerId, { action: "defer", ...d }));
    },
  };
}
