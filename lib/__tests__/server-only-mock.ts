// Vitest mock for server-only package.
// In Next.js, server-only throws when imported from client code.
// In vitest, we're running in Node.js, so we no-op it.
export {};
