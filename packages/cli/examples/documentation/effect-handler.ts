import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createEffectHandlerRuntime } from "@rexeus/typeweaver-effect";
import { Context, Data, Effect, Layer } from "effect";
import { adaptAccountEffectHandlers } from "../../../test-utils/src/test-project/output/account/EffectAccountApiHandler.js";
import { createRegisterAccountSuccessResponse } from "../../../test-utils/src/test-project/output/responses/RegisterAccountSuccessResponse.js";
import type {
  EffectAccountApiHandler,
  EffectAccountErrorMappers,
} from "../../../test-utils/src/test-project/output/account/EffectAccountApiHandler.js";

class RegistrationError extends Data.TaggedError("RegistrationError")<{
  readonly reason: string;
}> {}

class AccountStore extends Context.Tag("Example/AccountStore")<
  AccountStore,
  {
    readonly register: (
      email: string
    ) => Effect.Effect<string, RegistrationError>;
  }
>() {}

const accountStoreLayer = Layer.succeed(AccountStore, {
  register: email =>
    email.endsWith("@example.com")
      ? Effect.succeed("account-1")
      : Effect.fail(
          new RegistrationError({ reason: "unsupported email domain" })
        ),
});

const handlers = {
  handleRegisterAccountRequest: request =>
    Effect.gen(function* () {
      const store = yield* AccountStore;
      const accountId = yield* store.register(request.body.email);
      return createRegisterAccountSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          id: accountId,
          email: request.body.email,
          createdAt: "2026-07-26",
          modifiedAt: "2026-07-26",
          createdBy: "effect-example",
          modifiedBy: "effect-example",
        },
      });
    }),
} satisfies EffectAccountApiHandler<RegistrationError, AccountStore>;

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
} satisfies EffectAccountErrorMappers<RegistrationError>;

const runtime = createEffectHandlerRuntime(accountStoreLayer);

export const accountRequestHandlers = adaptAccountEffectHandlers(
  runtime,
  handlers,
  errorMappers
);

export const shutdownEffectHandlers = (): Promise<void> => runtime.dispose();
