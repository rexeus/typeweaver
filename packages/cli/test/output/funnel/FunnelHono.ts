import type { Context } from "hono";
import { TypeweaverHono, type HonoRequestHandler } from "../lib/hono";

import type { IGetFunnelRequest } from "./GetFunnelRequest";
import { GetFunnelRequestValidator } from "./GetFunnelRequestValidator";
import type { GetFunnelResponse } from "./GetFunnelResponse";

import type { IGetPublicFunnelRequest } from "./GetPublicFunnelRequest";
import { GetPublicFunnelRequestValidator } from "./GetPublicFunnelRequestValidator";
import type { GetPublicFunnelResponse } from "./GetPublicFunnelResponse";

import type { IListFunnelRequest } from "./ListFunnelRequest";
import { ListFunnelRequestValidator } from "./ListFunnelRequestValidator";
import type { ListFunnelResponse } from "./ListFunnelResponse";

export type FunnelApiHandler = {
  handleGetFunnelRequest: HonoRequestHandler<
    IGetFunnelRequest,
    GetFunnelResponse
  >;

  handleGetPublicFunnelRequest: HonoRequestHandler<
    IGetPublicFunnelRequest,
    GetPublicFunnelResponse
  >;

  handleListFunnelRequest: HonoRequestHandler<
    IListFunnelRequest,
    ListFunnelResponse
  >;
};

export class FunnelHono extends TypeweaverHono<FunnelApiHandler> {
  public constructor(handlers: FunnelApiHandler) {
    super({ requestHandlers: handlers });
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.get("/funnels/:funnelId", async (context: Context) =>
      this.handleRequest(
        context,
        new GetFunnelRequestValidator(),
        this.requestHandlers.handleGetFunnelRequest,
      ),
    );

    this.get("/public-funnels/:funnelId", async (context: Context) =>
      this.handleRequest(
        context,
        new GetPublicFunnelRequestValidator(),
        this.requestHandlers.handleGetPublicFunnelRequest,
      ),
    );

    this.get("/funnels", async (context: Context) =>
      this.handleRequest(
        context,
        new ListFunnelRequestValidator(),
        this.requestHandlers.handleListFunnelRequest,
      ),
    );
  }
}
