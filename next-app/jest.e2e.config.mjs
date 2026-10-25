import nextJest from "next/jest.js";
import { baseConfig } from "./jest.config.mjs";

const createJestConfig = nextJest({ dir: "./" });

/**
 * End-to-end checks against the real, running apps (Next.js on :3000, PHP on :8000).
 * Start both apps first, then run `npm run test:e2e`.
 */
export default createJestConfig({
  ...baseConfig,
  testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
  testTimeout: 30_000,
});
