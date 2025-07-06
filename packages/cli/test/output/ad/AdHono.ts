import type { Context } from "hono";
import { TypeweaverHono, type HonoRequestHandler } from "../lib/hono";

import type { IGetAdRequest } from "./GetAdRequest";
import { GetAdRequestValidator } from "./GetAdRequestValidator";
import type { GetAdResponse } from "./GetAdResponse";

import type { IListAdRequest } from "./ListAdRequest";
import { ListAdRequestValidator } from "./ListAdRequestValidator";
import type { ListAdResponse } from "./ListAdResponse";

export type AdApiHandler = {
  handleGetAdRequest: HonoRequestHandler<IGetAdRequest, GetAdResponse>;

  handleListAdRequest: HonoRequestHandler<IListAdRequest, ListAdResponse>;
};

export class AdHono extends TypeweaverHono<AdApiHandler> {
  public constructor(handlers: AdApiHandler) {
    super({ requestHandlers: handlers });
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.get("/ads/:adId", async (context: Context) =>
      this.handleRequest(
        context,
        new GetAdRequestValidator(),
        this.requestHandlers.handleGetAdRequest,
      ),
    );

    this.get("/ads", async (context: Context) =>
      this.handleRequest(
        context,
        new ListAdRequestValidator(),
        this.requestHandlers.handleListAdRequest,
      ),
    );
  }
}
