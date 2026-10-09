// Live grading switched off: pages are graded from data/demo-fallback.json
// (`pnpm demo:precompute`) and nothing calls a model. NEXT_PUBLIC_ so the
// browser can skip the judge and hide "Try your own" too; Next inlines it at
// build time, so turning it on or off takes a redeploy.
export const recordedMode = () => process.env.NEXT_PUBLIC_GRADERBOT_RECORDED === "1";
