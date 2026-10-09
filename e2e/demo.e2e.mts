import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright-core";

// The whole demo, click by click, with GRADERBOT_FAKE_MODEL=1 so it costs
// nothing. Uses an installed chromium: CHROMIUM_PATH, or Playwright's cache.
const PORT = 3299;
const BASE = `http://127.0.0.1:${PORT}`;
const executablePath = process.env.CHROMIUM_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;

const server = spawn("pnpm", ["next", "dev", "-H", "127.0.0.1", "-p", String(PORT)], {
  env: { ...process.env, GRADERBOT_FAKE_MODEL: "1", LANGSMITH_TRACING: "false" },
  stdio: ["ignore", "pipe", "inherit"],
  detached: true,
});
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("dev server did not start")), 60_000);
  server.stdout!.on("data", (d: Buffer) => {
    if (d.toString().includes("Ready")) {
      clearTimeout(timer);
      resolve();
    }
  });
});

const check = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`ok - ${what}`);
};

async function gradeAll(page: Page) {
  const cards = page.locator("article");
  await cards.first().waitFor({ timeout: 60_000 });
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    await cards.nth(i).getByRole("button", { name: i % 2 ? "Reject" : "Accept" }).click();
    if (i === 1) await cards.nth(i).getByLabel("Note to the learner").fill("Which part of the question does this answer?");
  }
  await page.getByRole("button", { name: "Submit page" }).click();
}

let failed = false;
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  await page.goto(BASE);
  check(await page.getByRole("heading", { name: /teacher still in the loop/ }).isVisible(), "landing renders");
  await page.getByRole("main").getByRole("link", { name: "Grade a page" }).click();
  await page.locator("article").first().waitFor({ timeout: 60_000 });
  check(await page.getByRole("button", { name: "Submit page" }).isDisabled(), "submit waits for every verdict");
  await gradeAll(page);
  await page.getByText(/In the time it took you to grade 8 responses, GraderBot could have graded \d+\./).waitFor({ timeout: 30_000 });
  check(true, "speed line after grading");
  await page.getByText("Fake judge: no model was called.").first().waitFor({ timeout: 30_000 });
  check(true, "judge comments stream in");

  await page.getByRole("link", { name: /Try your own question/ }).click();
  await page.getByLabel(/short-answer question/).fill("What does the cd command do?");
  await page.getByRole("button", { name: "Write the answers" }).click();
  await page.getByRole("button", { name: "Skip to GraderBot's grades" }).click();
  await page.getByText(/At your pace on the first page, these 8 would have taken you about/).waitFor({ timeout: 30_000 });
  check(true, "skip mode projects from the first page");
  check(await page.getByText(/matched the intended verdict on \d of 8/).isVisible(), "answer-key comparison");

  await page.goto(`${BASE}/try`);
  await page.getByLabel(/short-answer question/).fill("Which editor is best for beginners?");
  await page.getByRole("button", { name: "Write the answers" }).click();
  await page.getByText(/asks for an opinion/).waitFor({ timeout: 30_000 });
  check(true, "unfit question is turned away with a reason");

  check((await page.request.get(`${BASE}/api/queue`)).status() === 200, "queue still works locally");
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  await browser.close();
  process.kill(-server.pid!, "SIGTERM");
}
process.exit(failed ? 1 : 0);
