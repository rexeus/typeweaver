import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { Context, Data, Effect, Layer } from "effect";
import { adaptAccountEffectHandlers } from "test-utils/src/test-project/output/account/EffectAccountApiHandler.js";
import { createEffectHandlerRuntime } from "../src/index.js";
import type { ServerAccountApiHandler } from "test-utils/src/test-project/output/account/AccountRouter.js";
import type {
  EffectAccountApiHandler,
  EffectAccountErrorMappers,
} from "test-utils/src/test-project/output/account/EffectAccountApiHandler.js";

class AccountStore extends Context.Tag("TypeWeaverContract/AccountStore")<
  AccountStore,
  {
    readonly available: boolean;
  }
>() {}

class AccountFailure extends Data.TaggedError("AccountFailure")<{
  readonly reason: string;
}> {}

const runtime = createEffectHandlerRuntime(
  Layer.succeed(AccountStore, { available: true })
);

const handlers = {
  handleRegisterAccountRequest: request =>
    Effect.gen(function* () {
      const store = yield* AccountStore;
      return yield* new AccountFailure({
        reason: store.available
          ? request.body.email
          : "account store unavailable",
      });
    }),
} satisfies EffectAccountApiHandler<AccountFailure, AccountStore>;

const errorMappers = {
  handleRegisterAccountRequest: _error => ({
    type: "InternalServerError",
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    header: { "Content-Type": "application/json" },
    body: {
      message: "Internal server error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
  }),
} satisfies EffectAccountErrorMappers<AccountFailure>;

const adapted: ServerAccountApiHandler = adaptAccountEffectHandlers(
  runtime,
  handlers,
  errorMappers
);

type HandlerRequest = Parameters<
  typeof handlers.handleRegisterAccountRequest
>[0];
type IsAny<T> = 0 extends 1 & T ? true : false;
type RequestIsAny = IsAny<HandlerRequest>;
const requestIsNotAny: RequestIsAny = false;

void adapted;
void requestIsNotAny;
