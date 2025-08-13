import { createDataFactory } from "./createDataFactory";

export function createErrorResponseHeader<
  T extends { "Content-Type": "application/json" },
>(): (input?: Partial<T>) => T {
  return createDataFactory<T>(
    () =>
      ({
        "Content-Type": "application/json",
      }) as T
  );
}
