import { existsSync } from "node:fs";

// Next loads .env.local for the app; vitest does not.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
