import {
  type AwsLambdaRoute,
  type AwsLambdaHandler,
  HttpMethod,
  AwsLambdaHttpRouter,
} from "@rexeus/typeweaver-core";

import type { IRegisterAccountRequest } from "./RegisterAccountRequest";
import type {
  RegisterAccountSuccessResponses,
  IRegisterAccountResponse,
} from "./RegisterAccountResponse";
import { RegisterAccountRequestValidator } from "./RegisterAccountRequestValidator";

export type AccountAwsLambdaRouterHandler = {
  handleRegisterAccountRequest: AwsLambdaHandler<
    IRegisterAccountRequest,
    RegisterAccountSuccessResponses
  >;
};

type AccountRoutes = readonly [
  AwsLambdaRoute<
    HttpMethod.POST,
    "/accounts",
    IRegisterAccountRequest,
    IRegisterAccountResponse,
    RegisterAccountRequestValidator
  >,
];

export class AccountAwsLambdaRouter extends AwsLambdaHttpRouter<AccountRoutes> {
  private readonly routes: AccountRoutes;

  public constructor(private readonly handler: AccountAwsLambdaRouterHandler) {
    super();

    this.routes = [
      {
        path: "/accounts",
        method: HttpMethod.POST,
        handler: this.handler.handleRegisterAccountRequest,
        validator: new RegisterAccountRequestValidator(),
      },
    ] as const;
  }

  public getRoutes(): AccountRoutes {
    return this.routes;
  }
}
