import { ApiClient, type ApiClientProps } from "../lib/clients";

import { AccessTokenRequestCommand } from "./AccessTokenRequestCommand";
import type { SuccessfulAccessTokenResponse } from "./AccessTokenRequest";

import { RefreshTokenRequestCommand } from "./RefreshTokenRequestCommand";
import type { SuccessfulRefreshTokenResponse } from "./RefreshTokenRequest";

export type AuthRequestCommands =
  | AccessTokenRequestCommand
  | RefreshTokenRequestCommand;

export type SuccessfulAuthResponses =
  | SuccessfulAccessTokenResponse
  | SuccessfulRefreshTokenResponse;

export class AuthClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: AccessTokenRequestCommand,
  ): Promise<SuccessfulAccessTokenResponse>;

  public async send(
    command: RefreshTokenRequestCommand,
  ): Promise<SuccessfulRefreshTokenResponse>;

  public async send(
    command: AuthRequestCommands,
  ): Promise<SuccessfulAuthResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof AccessTokenRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof RefreshTokenRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
