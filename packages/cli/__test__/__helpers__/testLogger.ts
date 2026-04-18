import { vi } from "vitest";
import type { Logger } from "../../src/logger.js";

/**
 * Creates a Logger whose every channel is a fresh `vi.fn()`, so tests can
 * assert which messages were emitted. Use this instead of duplicating a
 * stub Logger in each test file.
 */
export const createTestLogger = (): Logger => ({
  isVerbose: false,
  debug: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  step: vi.fn(),
  summary: vi.fn(),
});
