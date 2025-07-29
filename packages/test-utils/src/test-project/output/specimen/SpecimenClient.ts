import { ApiClient, type ApiClientProps } from "../lib/clients";

import { PutSpecimenRequestCommand } from "./PutSpecimenRequestCommand";
import type { SuccessfulPutSpecimenResponse } from "./PutSpecimenRequest";

export type SpecimenRequestCommands = PutSpecimenRequestCommand;

export type SuccessfulSpecimenResponses = SuccessfulPutSpecimenResponse;

export class SpecimenClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: PutSpecimenRequestCommand,
  ): Promise<SuccessfulPutSpecimenResponse>;

  public async send(
    command: SpecimenRequestCommands,
  ): Promise<SuccessfulSpecimenResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof PutSpecimenRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
