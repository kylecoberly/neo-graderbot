# Evaluating Neo GraderBot in production

The offline rounds say what the agent does on 240 answers someone already
graded. In production nobody has graded the answer yet, so the question
becomes: how would we notice, quickly and cheaply, that filed grades have
started to go wrong?

## What runs online

Every grade, filed or deferred, is traced to LangSmith with contact
details masked (`src/lib/agent/mask.ts`). The instructor queue is the
labelling tool. Deferred answers are already in front of the instructor; a
sample of **filed** grades is put there too, as spot-checks. Start at 20%
per slice. Lower a slice's rate after a month without a disagreement; raise it
the moment one appears. Every decision the instructor makes in the queue is
appended to the LangSmith dataset `neo-graderbot-overrides` with the agent's decision
in its metadata, so production traffic becomes labelled data without anyone
writing a dataset by hand.

The hosted demo is the same idea at a smaller scale. Every live grading is
traced to the LangSmith project `neo-graderbot-demo`, and each page a visitor
submits adds two kinds of feedback to those traces: `visitor_agrees` (did the
visitor's verdict match the agent's) and `judge_better_verdict` (whose verdict
the page judge sided with). Filtering by `visitor_agrees = 0` lists the
disagreements to read. Visitors are not instructors, so this is a signal for
where to look, not a label set to merge into the core dataset.

## What alerts

- **Spot-check disagreement by slice.** Over the last 50 spot-checked grades
  in a slice, disagreement above that slice's offline false-accept plus
  false-reject rate, by more than the offline noise floor (11 to 14 of 120
  examples flipped between repetitions, so roughly 10 points), pages
  the instructor and pauses recording for that slice: everything defers until
  someone looks. Offline, Sonnet 5 files a wrong grade on 5% of what it
  records (3% false accepts, 3% false rejects), so the first alert is a slice
  passing 15% disagreement on its spot-checks.
- **The label audit, continuously.** The offline audit found a second grader
  disputing 16% of the 2022 verdicts. In production the equivalent is two instructors
  spot-checking the same sample for a week each quarter: if they disagree
  with each other as often as with the agent, the alert thresholds above are
  set against noise and need widening.
- **A shift in why things defer.** Each defer reason's share of the week's
  deferrals, against its offline share (offline, every deferral is certainty). A jump
  in `copied_from_lesson` means a new lesson or a cheating pattern; a jump in
  `no_retrieval` means questions that the corpus doesn't cover.
- **Guard trips on real learners.** The guard tripped on none of the 474 real
  answers offline. Any trip that an instructor then resolves as a legitimate
  answer is reviewed by a developer the same week; that is how the pattern
  list gets narrowed, never loosened silently.

## Online evaluators

The deterministic graders that need no label run on every trace as LangSmith
online evaluators: `reference_leaked`, `basis_grounded`, and
`retrieval_term_found`. They are free and they move first: in round 1 the
basis was grounded 0% of the time, after retrieval 85%; a drop there means
retrieval or the corpus broke before any grade looks wrong. The LLM judge's
criteria run only on a sample of filed rejections, and only the ones the
calibration showed it can be trusted on.

## The loop back

Once a month `neo-graderbot-overrides` is merged into the core set, with the
instructor's verdict as the expected outcome and the slice from its metadata.
Any change to the prompt, the policy, retrieval or the model reruns the core
and adversarial sets and ships only if it beats the noise floor, paired per
example, without lowering adversarial safety. Policy-only changes are checked
for free by replaying the last round's stored judgments
(`pnpm evals:replay`).

## What this cannot catch

- A grade that is right for the wrong reason, when the spot-checking
  instructor agrees anyway.
- The instructor's bar drifting. The 2022 labels are one person's standard in
  one cohort; a new instructor makes them partly stale, and the overrides
  dataset is the only signal that it has happened.
- Questions from lessons outside the corpus: they defer as `no_retrieval`,
  which is safe, but the deferral rate says nothing about quality there.
- Look-alike letters from other scripts and paraphrased instructions in an
  answer. The guard normalises and pattern-matches; the prompt frames the
  answer as data with an unguessable boundary; the adversarial set measures
  both. None of the three is a proof.
