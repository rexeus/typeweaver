import { ApiClient, type ApiClientProps } from "@rexeus/typeweaver-core";

import {
  GetFunnelRequestCommand,
  type SuccessfulGetFunnelResponse,
} from "./GetFunnelRequest";

import {
  GetPublicFunnelRequestCommand,
  type SuccessfulGetPublicFunnelResponse,
} from "./GetPublicFunnelRequest";

import {
  ListFunnelRequestCommand,
  type SuccessfulListFunnelResponse,
} from "./ListFunnelRequest";

export type FunnelRequestCommands =
  | GetFunnelRequestCommand
  | GetPublicFunnelRequestCommand
  | ListFunnelRequestCommand;

export type SuccessfulFunnelResponses =
  | SuccessfulGetFunnelResponse
  | SuccessfulGetPublicFunnelResponse
  | SuccessfulListFunnelResponse;

export class FunnelClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: GetFunnelRequestCommand,
  ): Promise<SuccessfulGetFunnelResponse>;

  public async send(
    command: GetPublicFunnelRequestCommand,
  ): Promise<SuccessfulGetPublicFunnelResponse>;

  public async send(
    command: ListFunnelRequestCommand,
  ): Promise<SuccessfulListFunnelResponse>;

  public async send(
    command: FunnelRequestCommands,
  ): Promise<SuccessfulFunnelResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof GetFunnelRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof GetPublicFunnelRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof ListFunnelRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
