import { ApiClient, type ApiClientProps } from "../lib/clients";

import { CreateTodoRequestCommand } from "./CreateTodoRequestCommand";
import type { SuccessfulCreateTodoResponse } from "./CreateTodoRequest";

import { DeleteTodoRequestCommand } from "./DeleteTodoRequestCommand";
import type { SuccessfulDeleteTodoResponse } from "./DeleteTodoRequest";

import { UpdateTodoRequestCommand } from "./UpdateTodoRequestCommand";
import type { SuccessfulUpdateTodoResponse } from "./UpdateTodoRequest";

import { UpdateTodoStatusRequestCommand } from "./UpdateTodoStatusRequestCommand";
import type { SuccessfulUpdateTodoStatusResponse } from "./UpdateTodoStatusRequest";

import { GetTodoRequestCommand } from "./GetTodoRequestCommand";
import type { SuccessfulGetTodoResponse } from "./GetTodoRequest";

import { ListTodosRequestCommand } from "./ListTodosRequestCommand";
import type { SuccessfulListTodosResponse } from "./ListTodosRequest";

export type TodoRequestCommands =
  | CreateTodoRequestCommand
  | DeleteTodoRequestCommand
  | UpdateTodoRequestCommand
  | UpdateTodoStatusRequestCommand
  | GetTodoRequestCommand
  | ListTodosRequestCommand;

export type SuccessfulTodoResponses =
  | SuccessfulCreateTodoResponse
  | SuccessfulDeleteTodoResponse
  | SuccessfulUpdateTodoResponse
  | SuccessfulUpdateTodoStatusResponse
  | SuccessfulGetTodoResponse
  | SuccessfulListTodosResponse;

export class TodoClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: CreateTodoRequestCommand,
  ): Promise<SuccessfulCreateTodoResponse>;

  public async send(
    command: DeleteTodoRequestCommand,
  ): Promise<SuccessfulDeleteTodoResponse>;

  public async send(
    command: UpdateTodoRequestCommand,
  ): Promise<SuccessfulUpdateTodoResponse>;

  public async send(
    command: UpdateTodoStatusRequestCommand,
  ): Promise<SuccessfulUpdateTodoStatusResponse>;

  public async send(
    command: GetTodoRequestCommand,
  ): Promise<SuccessfulGetTodoResponse>;

  public async send(
    command: ListTodosRequestCommand,
  ): Promise<SuccessfulListTodosResponse>;

  public async send(
    command: TodoRequestCommands,
  ): Promise<SuccessfulTodoResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof CreateTodoRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof DeleteTodoRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof UpdateTodoRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof UpdateTodoStatusRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof GetTodoRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof ListTodosRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
