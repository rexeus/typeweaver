import { Effect } from "effect";

export const implicitAnyEffect = Effect.fn("sentinel.implicitAny")(value =>
  Effect.succeed(value)
);
