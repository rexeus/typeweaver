import {
  type HonoHttpRoute,
  type HonoHttpRequestHandler,
  HttpMethod,
  HonoHttpRouter,
} from "@rexeus/typeweaver-core";

import type { IRegisterAccountRequest } from "./RegisterAccountRequest";
import type {
  RegisterAccountSuccessResponses,
  IRegisterAccountResponse,
} from "./RegisterAccountResponse";
import { RegisterAccountRequestValidator } from "./RegisterAccountRequestValidator";

export type AccountHonoRouterHandler = {
  handleRegisterAccountRequest: HonoHttpRequestHandler<
    IRegisterAccountRequest,
    RegisterAccountSuccessResponses
  >;
};

type AccountRoutes = readonly [
  HonoHttpRoute<
    HttpMethod.POST,
    "/accounts",
    IRegisterAccountRequest,
    IRegisterAccountResponse,
    RegisterAccountRequestValidator
  >,
];

export class AccountHonoRouter extends HonoHttpRouter<AccountRoutes> {
  private readonly routes: AccountRoutes;

  public constructor(private readonly handler: AccountHonoRouterHandler) {
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
