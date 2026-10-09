.PHONY: setup test demo evals summary

setup:
	pnpm install
	@test -f .env.local || (cp .env.example .env.local && echo "Fill in .env.local with your Anthropic and LangSmith keys.")

test:
	pnpm test

demo:
	pnpm dev

evals:
	pnpm evals

summary:
	pnpm evals:summary r1-baseline r2-retrieval r3-policy
