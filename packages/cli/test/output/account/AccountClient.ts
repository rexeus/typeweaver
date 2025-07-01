import { ApiClient, type ApiClientProps } from "../lib/clients";

import {
  RegisterAccountRequestCommand,
  type SuccessfulRegisterAccountResponse,
} from "./RegisterAccountRequest";

export type AccountRequestCommands = RegisterAccountRequestCommand;

export type SuccessfulAccountResponses = SuccessfulRegisterAccountResponse;

export class AccountClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: RegisterAccountRequestCommand,
  ): Promise<SuccessfulRegisterAccountResponse>;

  public async send(
    command: AccountRequestCommands,
  ): Promise<SuccessfulAccountResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof RegisterAccountRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
