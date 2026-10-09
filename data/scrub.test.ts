import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The client is never named in this repo, not even as a hash (a hash of one
// short word is reversible). The name comes from .env.local, so the check runs
// wherever the data can be regenerated and is skipped elsewhere.
const CLIENT = existsSync(".env.local")
  ? /^GRADERBOT_CLIENT=(.+)$/m.exec(readFileSync(".env.local", "utf8"))?.[1]?.trim().toLowerCase()
  : undefined;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === ".queue" ? [] : files(path);
    return name.endsWith(".test.ts") ? [] : [path];
  });
}

const checked = [...files("data"), ...files("evals/calibration")];

describe("committed data is scrubbed", () => {
  it("has data to check", () => expect(checked.length).toBeGreaterThan(3));

  it.each(checked)("%s holds no email address", (file) => {
    expect(EMAIL.test(readFileSync(file, "utf8")), "an email address appears in this file").toBe(false);
  });

  // Inside any word, not only as a word: a compound or a slug ("<name>credit",
  // "capstones-<name>") names the client just as well. No word in the data
  // contains it, so there is no allow-list (which would itself hint at it).
  it.skipIf(!CLIENT).each(checked)("%s does not name the client", (file) => {
    const words = readFileSync(file, "utf8").toLowerCase().match(/[a-z0-9]+/g) ?? [];
    expect(words.some((w) => w.includes(CLIENT!)), "the client's name appears in this file").toBe(false);
  });

  it.each(checked)("%s has no real username in a home-directory path", (file) => {
    const allowed = new Set(["user", "username", "you", "yourname", "your-name", "your_name", "name", "me", "learner", "pictures", "documents", "desktop", "downloads", "shared", "public", "music", "videos"]);
    const names = [...readFileSync(file, "utf8").matchAll(/(\/home\/|\/Users\/|[A-Za-z]:\\Users\\|(?<![\w/~.:])~(?=[A-Za-z]))(\w[\w.-]*\w|\w)/gi)].map((m) => m[2].toLowerCase());
    expect(names.filter((n) => !allowed.has(n)), "a username survives in a home-directory path").toEqual([]);
  });

  it("names learners only by pseudonym", () => {
    const answers = JSON.parse(readFileSync("data/answers.json", "utf8")) as { learner: string }[];
    expect(answers.filter((a) => !/^learner-\d{2}$/.test(a.learner))).toEqual([]);
  });
});
