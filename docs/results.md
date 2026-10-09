# Results

All numbers come from `pnpm evals:summary`, which reads the per-round scores
committed in `evals/results/`; the full reports with every output, which the
replay and failure tools need, are in the gitignored `evals/.results/`. Each
round runs every example three times unless noted.

Every grade the agent drafts goes to the instructor's queue. "Filed" means
the policy marked it ready to approve; "deferred" means it flagged it for a
closer look, with the reason. False accepts and false rejects are rates
**among filed grades**: a deferred mistake costs the instructor a minute, a
filed one gets approved on the nod and costs the learner a wrong grade.

The noise floor is the number of examples whose own three repetitions
disagreed. A change between rounds counts only if the examples that improved
outnumber those that regressed by more than that (`pnpm evals:compare`).

## Headline

Core set: 120 lesson questions, JS arrays and HTML, 360 runs per round.

| | r1 model alone | r2 + retrieval | r3 + guard and policy | final: r3 on Sonnet 5 |
|---|---|---|---|---|
| agreement with the 2022 verdict | 55% | 74% | 75% | 83% |
| deferred to the instructor | 0% | 0% | 21% | 34% |
| false accepts, of filed | 3% | 4% | 5% | 3% |
| false rejects, of filed | 43% | 22% | 5% | 3% |
| adversarial cases handled safely | 85% | 80% | 100% | 100% |
| p50 latency / cost per 100 answers | 7.2 s / $0.15 | 2.0 s / $0.22 | 2.0 s / $0.22 | 1.7 s / $0.61 |

Sonnet ran once per example with the judge off; the Haiku rounds are the
mean of three repetitions. Latency and cost are LangSmith's figures.

## Rounds

| round | what changed | core experiment | adversarial experiment |
|---|---|---|---|
| r1-baseline | Haiku 4.5 alone: no retrieval, no guard, no policy; files everything | [diligent-fold-58](https://smith.langchain.com/public/1e735ea7-a311-4128-9eee-2ad0bb780537/d/compare?selectedSessions=c430ac7c-19ee-4f03-a624-bc78f163d701) | [crushing-offer-80](https://smith.langchain.com/public/004115ef-bfd7-436c-82fe-d65e61059fc8/d/compare?selectedSessions=3d1eff58-4757-47b6-a5ff-0009b43c4c36) |
| r2-retrieval | + the lesson's passages | [definite-fuel-14](https://smith.langchain.com/public/1e735ea7-a311-4128-9eee-2ad0bb780537/d/compare?selectedSessions=00bc717d-8019-4f77-8fd4-4f2059183fc7) | [puzzled-hand-91](https://smith.langchain.com/public/004115ef-bfd7-436c-82fe-d65e61059fc8/d/compare?selectedSessions=84703568-624c-414c-96df-6caf8b332350) |
| r3-policy | + the guard and the recording policy, pasted-text check included | [flowery-play-49](https://smith.langchain.com/public/1e735ea7-a311-4128-9eee-2ad0bb780537/d/compare?selectedSessions=e7b1f102-5430-40cc-b2a5-a94a5ba68690) | [crushing-education-67](https://smith.langchain.com/public/004115ef-bfd7-436c-82fe-d65e61059fc8/d/compare?selectedSessions=a4968e47-c07d-40ab-8a42-2f9093acfb35) |
| final-sonnet | r3 with Sonnet 5 as the agent, one repetition | [abandoned-mitten-30](https://smith.langchain.com/public/1e735ea7-a311-4128-9eee-2ad0bb780537/d/compare?selectedSessions=892b6b28-1c03-44d4-8a2b-ce96e14c119e) | [kind-tub-32](https://smith.langchain.com/public/004115ef-bfd7-436c-82fe-d65e61059fc8/d/compare?selectedSessions=8b8f6944-c85d-40e7-b8ef-f3d30282f997) |

Datasets: [neo-graderbot-core](https://smith.langchain.com/public/1e735ea7-a311-4128-9eee-2ad0bb780537/d), [neo-graderbot-adversarial](https://smith.langchain.com/public/004115ef-bfd7-436c-82fe-d65e61059fc8/d).
`pnpm evals:experiments` lists every experiment with its latency and cost.

### Core, by slice: r1 → r2 → r3 → final

| slice | n | deferred | agreement | false accept (of filed) | false reject (of filed) | leaked | grounded | hints | accurate | voice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| arrays | 180 | 0% → 0% → 19% → 32% | 67% → 80% → 81% → 83% | 2% → 5% → 5% → 2% | 31% → 15% → 1% → 0% | 0% | 0% → 96% → 95% → 95% | 93% → 86% → 76% | 82% → 82% → 85% | 69% → 88% → 80% |
| html | 180 | 0% → 0% → 23% → 37% | 43% → 68% → 69% → 83% | 3% → 4% → 4% → 3% | 54% → 28% → 9% → 5% | 0% | – → 94% → 93% → 96% | 91% → 90% → 89% | 48% → 87% → 87% | 58% → 56% → 56% |
| all | 360 | 0% → 0% → 21% → 34% | 55% → 74% → 75% → 83% | 3% → 4% → 5% → 3% | 43% → 22% → 5% → 3% | 0% | 0% → 95% → 94% → 96% | 92% → 88% → 83% | 63% → 84% → 86% | 63% → 71% → 67% |

Noise floor (examples whose verdict differed across their repetitions):
r1 14, r2 13, r3 11. The judge columns are calibrated below (the judge is
stricter than the instructor, so read them as a floor); no decision rests on
them.

### Adversarial

| category | n | safe r1 → r2 → r3 → final | expectation met |
| --- | --- | --- | --- |
| injection | 24 | 71% → 63% → 100% → 100% | 0% → 0% → 100% → 100% |
| empty | 12 | 100% → 100% → 100% → 100% | 0% → 0% → 100% → 100% |
| too_long | 6 | 50% → 83% → 100% → 100% | 0% → 0% → 100% → 100% |
| pii | 9 | 44% → 11% → 100% → 100% | 0% → 0% → 100% → 100% |
| lesson_pasted | 12 | 75% → 50% → 100% → 100% | 0% → 0% → 100% → 100% |
| wrong_question | 12 | 100% | 100% |
| confident_wrong | 18 | 100% | 100% |
| rhetoric | 9 | 100% | 100% |
| buried_correct | 9 | 100% | 100% |
| terse_correct | 9 | 100% | 67% → 100% → 100% → 100% |
| all | 120 | 85% → 80% → 100% → 100% | 45% → 48% → 100% → 100% |

## What moved

**r1: the model alone is stricter than the instructor.** Haiku with only the
question agrees 55% of the time, and nearly every miss is a rejection of an
answer the instructor accepted: 43% of its grades, against 3% wrong
acceptances. HTML is worse than arrays (43% vs 67%) because without the lesson
it grades "What is an HTML tag?" against its own idea of a complete answer.

**r2: retrieval is the big step.** Paired per example, agreement improved on
37 and regressed on 8 (floor 14): 55% → 74%, false rejections 43% → 22%.
Retrieval also made the model slightly more willing to accept the wrong
thing (3 examples), and more exposed to pasted lesson text (adversarial safe
85% → 80%): the lesson in the prompt is what gets pasted.

**r3: the policy decides what gets written, not what the verdict is.**
Agreement moves within the noise (9 improved, 5 regressed, floor 13). What
moves is the filed error: false rejections among filed grades improved
on 28 examples and regressed on 1, 22% → 5%, for 21% of answers deferred.
Every deferral is for certainty; the guard tripped on no real answer. On the
adversarial set every injection, empty, over-long, contact-details and
pasted-lesson case now reaches a human, and no wrong answer is filed as
correct.

**final: Sonnet 5.** With the model as the only change, agreement improved on
18 examples and regressed on 6 (floor 11): 75% → 83%. Filed error falls to
3% false accepts and 3% false rejects, at the price of deferring 34% instead
of 21%. It is also faster here (p50 1.7 s vs 2.0 s) and costs $0.61 per 100
answers against Haiku's $0.22: for a cohort of 18,000 answers, about $70
more. The demo runs it.

## What the final agent gets wrong

Four filed grades in 120 disagree with the 2022 labels
(`pnpm evals:failures final-sonnet`): a-10352, a-5420, a-2376, a-4440. Every
one at `high` certainty, so the certainty check cannot reach them. After the
label audit below, two of the four (a-5420, a-2376) are the instructor's
errors, not the agent's. Everything else it got wrong, it deferred.

## Label audit: how good are the labels?

Every number above is agreement with one instructor's 2022 verdicts, made at
about twelve seconds each. `pnpm audit:labels` had Opus 5 grade the core set
blind, against the same lesson passages and bar, with no sight of the 2022
verdict.

| slice | n | agree | disputed | 2022 stricter | 2022 looser |
| --- | --- | --- | --- | --- | --- |
| arrays | 60 | 82% | 11 | 8 | 3 |
| html | 60 | 87% | 8 | 3 | 5 |
| all | 120 | 84% | 19 | 11 | 8 |

Read against only the 101 labels both graders agree on, with no new model
calls:

| core set | all 120 labels | 101 undisputed labels |
| --- | --- | --- |
| r3 Haiku: agreement / wrong filed grades | 75% / 10% | 83% / 3% |
| final Sonnet 5: agreement / wrong filed grades | 83% / 5% | 93% / 0% |

The instructor refereed the 19 disputes by hand (`label-audit.md`, `concede`
in `label-audit.json`): on 10 the 2022 call stands, on 9 the second grader
had it right (3 of 11 in arrays, 6 of 8 in HTML). That puts the 2022 labels
at 93% right. Flipping the 9 conceded labels and re-scoring the stored
rounds, with no model calls:

| core set | 2022 labels | corrected labels |
| --- | --- | --- |
| r3 Haiku: agreement / wrong filed grades | 75% / 10% | 80% / 6% |
| final Sonnet 5: agreement / wrong filed grades | 83% / 5% | 89% / 3% |

Two of the final agent's four filed disagreements (a-5420, a-2376) were the
instructor's mistakes; a-10352 and a-4440 remain its own. The rounds above
are reported against the 2022 labels so they stay comparable with each
other.

## The six-topic version

The first dataset covered six topics chosen to span the archive's reject
rates: pseudocode programs, HTML (lesson questions and style questions
together), JS arrays, and CLI, Git and Spring Boot vocabulary. Its rounds are
kept under the `six-` labels (`pnpm evals:summary six-r1-baseline
six-r4-copied-lesson six-final-sonnet`) and taught three things:

- **Pasted lesson text needs its own check.** The policy's certainty gate
  filed full marks for copied lesson text in 9 of 12 runs; a twelve-word
  overlap check (`copiesPassage`) fixed it, verified by replaying the stored
  judgments with no model calls. That check is part of r3 above.
- **A looser grading bar in the prompt did not beat the floor.** Three
  sentences telling the model that style is never a reason to reject moved
  every number the right way (agreement +3, false rejects −4) but a net of 18
  improved examples did not clear a floor of 24–26, and false accepts crept
  up. Reverted.
- **Two of the six topics were measuring the labels, not the agent.**
  Pseudocode and the HTML style questions were graded on formatting, and a
  second grader disputed 40% of the pseudocode labels; the three vocabulary
  topics gave retrieval a single word to match, so "Additional Resources"
  sections won and the agent deferred 65–78% of them. On that set the final
  agent reached 76% agreement with 54% deferred; on lesson questions alone,
  83% with 34%. The narrowing is a dataset decision made from the evals and
  the audit, and the README says so.

## Judge calibration

Thirty agent rejection notes from r3, fifteen per slice, labelled by the
instructor blind (`evals/calibration/feedback-labels.md`; the judge's
verdicts were kept apart in `feedback-judge.json` until the labels were in):
27 `hint`, 2 `reveals`, 1 `wrong`. `pnpm calibrate` compares, with no model
calls; the labelled set is the LangSmith dataset
`neo-graderbot-judge-calibration`.

| judge criterion | labelled | agreement | judge failed a note the instructor passed | judge passed a note the instructor failed |
| --- | --- | --- | --- | --- |
| `hints_not_reveals` | 29 | 93% | 2 | 0 |
| `accurate` | 30 | 83% | 5 | 0 |

Both clear the 80% bar the script asks for. Every disagreement runs one way:
the judge is stricter than the instructor and never missed a note the
instructor failed, so its columns in the tables above read as a floor on
note quality, not an estimate. The five `accurate` disagreements are notes
that nudge toward a detail the lesson doesn't settle (whether `.length`
needs parentheses, whether `.concat` counts as "in the lesson"); the two
`hints` disagreements are notes the judge thought gave too much away.
