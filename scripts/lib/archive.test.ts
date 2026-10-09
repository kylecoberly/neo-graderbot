import { describe, expect, it } from "vitest";
import type { GradedAnswer, Slice } from "@/lib/types";
import { SLICES } from "@/lib/types";
import {
  assertNoLearnerHandles,
  buildAnswers,
  buildQuestions,
  findHardPairs,
  handlesOf,
  pseudonyms,
  redact,
  split,
  toEvaluations,
  type EvaluationRow,
  type PerformanceRow,
} from "./archive";

const perf = (over: Partial<PerformanceRow> & { id: number }): PerformanceRow => ({
  createdAt: "2022-03-01 10:00:00+00",
  userId: "pat@example.com",
  postSlug: "js-arrays-questions-question-3",
  type: "question",
  payload: { originalPostSlug: "js-arrays-questions", prompt: "**CLI**", answer: "", response: "Command line interface" },
  ...over,
});
const evaluation = (over: Partial<EvaluationRow> & { id: number; performanceId: number }): EvaluationRow => ({
  status: "accepted",
  feedback: null,
  createdAt: "2022-04-01 09:00:00+00",
  evaluatorId: "instructor",
  ...over,
});

describe("toEvaluations", () => {
  it("keeps when and by whom, for the grading-hours aggregate", () => {
    const [row] = toEvaluations([
      { id: "1", createdAt: "2022-04-01 09:00:00+00", updatedAt: null, feedback: null, status: "accepted", learnerId: "x", evaluatorId: "ev", performanceId: "7" },
    ]);
    expect(row).toEqual({ id: 1, status: "accepted", feedback: null, performanceId: 7, createdAt: "2022-04-01 09:00:00+00", evaluatorId: "ev" });
  });
});

describe("pseudonyms", () => {
  it("is stable regardless of input order", () => {
    const a = pseudonyms(["x@e.com", "y@e.com", "x@e.com"], "salt");
    const b = pseudonyms(["y@e.com", "x@e.com"], "salt");
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
    expect([...a.values()].sort()).toEqual(["learner-01", "learner-02"]);
  });
  // Unsalted, anyone holding the roster could recompute who learner-07 is.
  it("orders by a secret salt, so the roster alone does not reveal the mapping", () => {
    const roster = ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com"];
    expect([...pseudonyms(roster, "one").entries()]).not.toEqual([...pseudonyms(roster, "two").entries()]);
  });
  it("refuses an empty salt", () => {
    expect(() => pseudonyms(["a@x.com"], "")).toThrow(/salt/);
  });
});

describe("redact", () => {
  it("removes email addresses", () => {
    expect(redact("mail me at pat.q@corp.example.com today", "acme")).toBe("mail me at [email] today");
  });
  it("replaces the client's name as a word, keeping its case", () => {
    expect(redact('["Acme", "acme", "ACME"]', "acme")).toBe('["Volvo", "volvo", "VOLVO"]');
  });
  it("leaves the name alone inside another word", () => {
    expect(redact("acmes and macme", "acme")).toBe("acmes and macme");
  });
  it("replaces any username in a home-directory path, not only known handles", () => {
    expect(redact("e.g. /home/zorblax/notes and /Users/Q.Smith/Desktop", "acme")).toBe("e.g. /home/learner/notes and /Users/learner/Desktop");
    expect(redact(String.raw`C:\Users\zorblax\Documents`, "acme")).toBe(String.raw`C:\Users\learner\Documents`);
  });
  it("keeps placeholder usernames that teach the idea", () => {
    expect(redact("/home/user/docs and /Users/username and /home/you", "acme")).toBe("/home/user/docs and /Users/username and /home/you");
    expect(redact("If I'm in /Home/Pictures/Media", "acme")).toBe("If I'm in /Home/Pictures/Media");
  });
  it("catches a handle joined to other word characters by an underscore or digits", () => {
    expect(redact("cd jdoe_notes; ls JDOE2", "acme", ["jdoe"])).toBe("cd learner_notes; ls learner");
  });
  it("replaces a username written with a tilde", () => {
    expect(redact("cd ~zorblax/notes, but ~/notes is mine", "acme")).toBe("cd ~learner/notes, but ~/notes is mine");
  });
  it("leaves git revisions and public URLs with a tilde alone", () => {
    expect(redact("git reset HEAD~1; see https://example.edu/~prof/notes.pdf", "acme")).toBe("git reset HEAD~1; see https://example.edu/~prof/notes.pdf");
  });
  it("replaces learner handles, such as a home directory", () => {
    expect(redact("~ is /home/jdoe on my machine", "acme", ["jdoe"])).toBe("~ is /home/learner on my machine");
  });
});

describe("buildQuestions", () => {
  it("redacts learner handles from prompts and references", () => {
    const [q] = buildQuestions(
      [perf({ id: 1, payload: { originalPostSlug: "js-arrays-questions", prompt: "**What is /home/jdoe?**", answer: "jdoe's home directory" } })],
      "acme",
      ["jdoe"],
    );
    expect(q.prompt).toBe("**What is /home/learner?**");
    expect(q.reference).toBe("learner's home directory");
  });

  it("keeps the latest prompt snapshot, nulls placeholder references, drops other posts", () => {
    const questions = buildQuestions(
      [
        perf({ id: 1, createdAt: "2022-03-01 10:00:00+00", payload: { originalPostSlug: "js-arrays-questions", prompt: "old", answer: "Placeholder" } }),
        perf({ id: 2, createdAt: "2022-03-05 10:00:00+00", payload: { originalPostSlug: "js-arrays-questions", prompt: "**CLI**", answer: "Placeholder" } }),
        perf({ id: 3, postSlug: "java-vocabulary-1-question-1", payload: { originalPostSlug: "java-vocabulary-1", prompt: "Java" } }),
      ],
      "acme",
    );
    expect(questions).toEqual([{ id: "js-arrays-questions-question-3", slice: "arrays", prompt: "**CLI**", reference: null }]);
  });
});

describe("buildAnswers", () => {
  const names = new Map([["pat@example.com", "learner-01"]]);

  it("redacts the learner's own handle from their answer", () => {
    const [a] = buildAnswers(
      [perf({ id: 20, userId: "patq99@example.com", payload: { originalPostSlug: "js-arrays-questions", prompt: "**~**", response: "/home/patq" } })],
      [evaluation({ id: 9, performanceId: 20 })],
      new Map([["patq99@example.com", "learner-01"]]),
      "acme",
    );
    expect(a.answer).toBe("/home/learner");
  });

  it("uses the latest evaluation, drops superseded ones, numbers attempts", () => {
    const answers = buildAnswers(
      [
        perf({ id: 10, createdAt: "2022-03-01 10:00:00+00" }),
        perf({ id: 11, createdAt: "2022-03-02 10:00:00+00" }),
        perf({ id: 12, createdAt: "2022-03-03 10:00:00+00" }),
        perf({ id: 13, type: "view", payload: {} }),
      ],
      [
        evaluation({ id: 1, performanceId: 10, status: "accepted" }),
        evaluation({ id: 2, performanceId: 10, status: "rejected", feedback: " Close- try contrasting it with GUI " }),
        evaluation({ id: 3, performanceId: 11, status: "deferred", feedback: "Another performance was submitted" }),
        evaluation({ id: 4, performanceId: 12, status: "accepted" }),
      ],
      names,
      "acme",
    );
    expect(answers).toEqual([
      {
        id: "a-10", questionId: "js-arrays-questions-question-3", slice: "arrays", learner: "learner-01",
        answer: "Command line interface", attempt: 1, verdict: "reject",
        feedback: "Close- try contrasting it with GUI", answeredOn: "2022-03-01",
      },
      {
        id: "a-12", questionId: "js-arrays-questions-question-3", slice: "arrays", learner: "learner-01",
        answer: "Command line interface", attempt: 2, verdict: "accept", feedback: null, answeredOn: "2022-03-03",
      },
    ]);
  });
});

function answer(slice: Slice, learner: number, q: number, attempt: number, verdict: "accept" | "reject"): GradedAnswer {
  return {
    id: `a-${slice}-${learner}-${q}-${attempt}`, questionId: `${slice}-q-${q}`, slice,
    learner: `learner-${String(learner).padStart(2, "0")}`, answer: "x", attempt, verdict, feedback: null, answeredOn: "2022-03-01",
  };
}

describe("findHardPairs", () => {
  it("pairs a rejection with the accepted attempt right after it", () => {
    const pairs = findHardPairs([
      answer("arrays", 1, 1, 1, "reject"),
      answer("arrays", 1, 1, 2, "reject"),
      answer("arrays", 1, 1, 3, "accept"),
      answer("arrays", 2, 1, 1, "accept"),
      answer("arrays", 2, 1, 2, "reject"),
    ]);
    expect(pairs).toEqual([["a-arrays-1-1-2", "a-arrays-1-1-3"]]);
  });
});

describe("split", () => {
  const answers: GradedAnswer[] = [];
  for (const slice of SLICES) {
    for (let learner = 1; learner <= 21; learner++) {
      for (let q = 1; q <= 6; q++) {
        if ((learner + q) % 5 === 0) {
          answers.push(answer(slice, learner, q, 1, "reject"), answer(slice, learner, q, 2, "accept"));
        } else {
          answers.push(answer(slice, learner, q, 1, (learner * q) % 7 === 0 ? "reject" : "accept"));
        }
      }
    }
  }
  const pairs = findHardPairs(answers);
  const s = split(answers, pairs, 42);
  const group = (id: string) => id.split("-").slice(1, 4).join("-");

  it("is deterministic for a seed", () => expect(split(answers, pairs, 42)).toEqual(s));
  it("never puts one learner's attempts at a question on both sides", () => {
    const held = new Set(s.heldout.map(group));
    expect(s.core.some((id) => held.has(group(id)))).toBe(false);
  });
  it("sizes each slice", () => {
    for (const slice of SLICES) {
      const core = s.core.filter((id) => id.startsWith(`a-${slice}-`));
      const held = s.heldout.filter((id) => id.startsWith(`a-${slice}-`));
      expect(core.length).toBeLessThanOrEqual(60);
      expect(core.length).toBeGreaterThanOrEqual(30);
      expect(held.length).toBeGreaterThanOrEqual(10);
    }
  });
  it("keeps both halves of every chosen hard pair in core", () => {
    expect(s.hardPairs.length).toBeGreaterThan(0);
    for (const [r, a] of s.hardPairs) expect(s.core).toEqual(expect.arrayContaining([r, a]));
    for (const slice of SLICES) expect(s.hardPairs.filter(([r]) => r.startsWith(`a-${slice}-`)).length).toBeLessThanOrEqual(6);
  });
});

describe("split when most groups have several attempts", () => {
  // Pseudocode in the archive: rejections almost always led to a retry, so
  // single-attempt groups alone cannot supply the slice's rejections.
  const answers: GradedAnswer[] = [];
  for (const slice of SLICES) {
    for (let learner = 1; learner <= 21; learner++) {
      for (let q = 1; q <= 8; q++) {
        answers.push(answer(slice, learner, q, 1, "reject"), answer(slice, learner, q, 2, "reject"), answer(slice, learner, q, 3, "accept"));
      }
    }
  }
  const s = split(answers, findHardPairs(answers), 7);

  it("still fills every slice to 60 at its natural reject rate", () => {
    for (const slice of SLICES) {
      const core = answers.filter((a) => a.slice === slice && s.core.includes(a.id));
      expect(core).toHaveLength(60);
      expect(core.filter((a) => a.verdict === "reject").length).toBe(Math.round(60 * (2 / 3)));
    }
  });
  it("takes at most one row from a group outside the hard pairs", () => {
    const group = (id: string) => id.split("-").slice(1, 4).join("-");
    const paired = new Set(s.hardPairs.flat());
    const singles = s.core.filter((id) => !paired.has(id)).map(group);
    expect(new Set(singles).size).toBe(singles.length);
  });
});

describe("handlesOf", () => {
  it("takes the whole local part and each name in it", () => {
    expect(handlesOf(["rivera.jamie7@x.com", "jo.li@x.com"]).sort()).toEqual(["rivera", "rivera.jamie", "jamie", "jo.li"].sort());
  });
});

describe("assertNoLearnerHandles", () => {
  it("catches a handle next to an underscore", () => {
    expect(() => assertNoLearnerHandles("see sking_notes", ["sking171@x.com"])).toThrow(/survives/);
  });
  it("throws when a handle survives as a word", () => {
    expect(() => assertNoLearnerHandles("signed, sking", ["sking171@x.com"])).toThrow(/survives/);
  });
  it("ignores the handle inside another word", () => {
    expect(() => assertNoLearnerHandles("I was asking", ["sking171@x.com"])).not.toThrow();
  });
});
