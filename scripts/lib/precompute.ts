// Runs one model call per id, a few at a time, with one retry each, so a
// transient provider error doesn't leave a hole in the stored file.
export async function precompute<T>(
  ids: string[],
  grade: (id: string) => Promise<T>,
  { concurrency }: { concurrency: number },
): Promise<{ results: Record<string, T>; failed: string[] }> {
  const results: Record<string, T> = {};
  const failed: string[] = [];
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        results[id] = await grade(id);
      } catch {
        try {
          results[id] = await grade(id);
        } catch {
          failed.push(id);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { results, failed };
}
