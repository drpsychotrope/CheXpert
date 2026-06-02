// Minimal Node.js globals for test files (avoids a hard @types/node dev dependency).
// Vitest runs in Node so these are available at runtime; this file silences tsc.
declare function require(id: string): unknown;
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};
