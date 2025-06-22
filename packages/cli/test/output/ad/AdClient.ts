import { ApiClient, type ApiClientProps } from "@rexeus/typeweaver-core";

import {
  GetAdRequestCommand,
  type SuccessfulGetAdResponse,
} from "./GetAdRequest";

import {
  ListAdRequestCommand,
  type SuccessfulListAdResponse,
} from "./ListAdRequest";

export type AdRequestCommands = GetAdRequestCommand | ListAdRequestCommand;

export type SuccessfulAdResponses =
  | SuccessfulGetAdResponse
  | SuccessfulListAdResponse;

export class AdClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: GetAdRequestCommand,
  ): Promise<SuccessfulGetAdResponse>;

  public async send(
    command: ListAdRequestCommand,
  ): Promise<SuccessfulListAdResponse>;

  public async send(
    command: AdRequestCommands,
  ): Promise<SuccessfulAdResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof GetAdRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof ListAdRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
