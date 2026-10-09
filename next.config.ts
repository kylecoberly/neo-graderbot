import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // initChatModel imports the provider package by name at runtime, which the
  // bundler cannot follow; loading these from node_modules keeps that working.
  serverExternalPackages: ["langchain", "@langchain/core", "@langchain/anthropic", "@langchain/langgraph", "langsmith"],
  // Routes read data/ at request time; Vercel only ships files the tracer can see.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
    "/lesson/**": ["./data/corpus/**/*"],
    "/about": ["./data/grading-hours.json"],
  },
};

export default nextConfig;
