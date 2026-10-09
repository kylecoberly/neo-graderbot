// Why the policy flagged an answer for the instructor, as the queue and the demo say it.
export const REASONS: Record<string, string> = {
  "guard:empty": "No answer to grade",
  "guard:too_long": "Longer than any real answer",
  "guard:pii": "Contains contact details",
  "guard:injection": "Tries to instruct the grader",
  copied_from_lesson: "Copied from the lesson",
  certainty: "The agent wasn't sure",
  no_retrieval: "The lesson doesn't cover it",
  leaks_reference: "The draft gives the answer away",
};
