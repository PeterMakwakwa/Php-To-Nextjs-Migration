import nextJest from "next/jest.js";

// next/jest compiles TypeScript with Next's own SWC setup and loads next.config / .env files.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
export const baseConfig = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // `server-only` throws outside a React Server environment; it is a no-op for unit tests.
    "^server-only$": "<rootDir>/tests/support/empty.ts",
  },
};

export default createJestConfig({
  ...baseConfig,
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
});
