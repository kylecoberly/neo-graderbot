import { writeFileSync } from "node:fs";
import { loadAnswers, loadQuestions } from "@/lib/data";
import { buildPool } from "@/lib/demo/pool";

const pool = buildPool(loadQuestions(), loadAnswers());
writeFileSync("data/demo-questions.json", JSON.stringify(pool, null, 2) + "\n");
console.table(pool);
console.log(`${pool.length} questions`);
