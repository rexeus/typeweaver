import { createDataFactory } from "./createDataFactory";

export function createErrorResponseHeaders<
  T extends { "Content-Type": "application/json" },
>(): (input?: Partial<T>) => T {
  return createDataFactory<T>(
    () =>
      ({
        "Content-Type": "application/json",
      }) as T
  );
}
