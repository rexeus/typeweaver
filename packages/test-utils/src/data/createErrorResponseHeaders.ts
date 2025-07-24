import { createData } from "./createData";

export function createErrorResponseHeaders<
  T extends { "Content-Type": "application/json" },
>(input: Partial<T> = {}): T {
  const defaults = {
    "Content-Type": "application/json" as const,
  };

  return createData(defaults as T, input);
}