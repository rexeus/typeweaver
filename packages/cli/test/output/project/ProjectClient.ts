import { ApiClient, type ApiClientProps } from "@rexeus/typeweaver-core";

import {
  CreateProjectRequestCommand,
  type SuccessfulCreateProjectResponse,
} from "./CreateProjectRequest";

import {
  GetProjectRequestCommand,
  type SuccessfulGetProjectResponse,
} from "./GetProjectRequest";

import {
  ListProjectRequestCommand,
  type SuccessfulListProjectResponse,
} from "./ListProjectRequest";

import {
  SetProjectStatusRequestCommand,
  type SuccessfulSetProjectStatusResponse,
} from "./SetProjectStatusRequest";

import {
  UpdateProjectRequestCommand,
  type SuccessfulUpdateProjectResponse,
} from "./UpdateProjectRequest";

export type ProjectRequestCommands =
  | CreateProjectRequestCommand
  | GetProjectRequestCommand
  | ListProjectRequestCommand
  | SetProjectStatusRequestCommand
  | UpdateProjectRequestCommand;

export type SuccessfulProjectResponses =
  | SuccessfulCreateProjectResponse
  | SuccessfulGetProjectResponse
  | SuccessfulListProjectResponse
  | SuccessfulSetProjectStatusResponse
  | SuccessfulUpdateProjectResponse;

export class ProjectClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public async send(
    command: CreateProjectRequestCommand,
  ): Promise<SuccessfulCreateProjectResponse>;

  public async send(
    command: GetProjectRequestCommand,
  ): Promise<SuccessfulGetProjectResponse>;

  public async send(
    command: ListProjectRequestCommand,
  ): Promise<SuccessfulListProjectResponse>;

  public async send(
    command: SetProjectStatusRequestCommand,
  ): Promise<SuccessfulSetProjectStatusResponse>;

  public async send(
    command: UpdateProjectRequestCommand,
  ): Promise<SuccessfulUpdateProjectResponse>;

  public async send(
    command: ProjectRequestCommands,
  ): Promise<SuccessfulProjectResponses> {
    const response = await this.execute(command);

    switch (true) {
      case command instanceof CreateProjectRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof GetProjectRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof ListProjectRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof SetProjectStatusRequestCommand: {
        return command.processResponse(response);
      }

      case command instanceof UpdateProjectRequestCommand: {
        return command.processResponse(response);
      }

      default: {
        throw new Error("Command is not supported");
      }
    }
  }
}
