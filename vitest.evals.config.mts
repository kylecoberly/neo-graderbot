import { defineConfig } from "vitest/config";

// Evals call real models and report to LangSmith, so they live under their own
// config and suffix; `pnpm test` never picks up *.eval.ts. Tests inside a file
// run concurrently because a round is hundreds of model calls.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    setupFiles: ["evals/setup.ts"],
    testTimeout: 300_000,
    fileParallelism: false,
    sequence: { concurrent: true },
    maxConcurrency: Number(process.env.EVAL_CONCURRENCY ?? 8),
  },
});
