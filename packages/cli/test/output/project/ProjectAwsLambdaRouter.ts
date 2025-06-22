import {
  type AwsLambdaRoute,
  type AwsLambdaHandler,
  HttpMethod,
  AwsLambdaHttpRouter,
} from "@rexeus/typeweaver-core";

import type { ICreateProjectRequest } from "./CreateProjectRequest";
import type {
  CreateProjectSuccessResponses,
  ICreateProjectResponse,
} from "./CreateProjectResponse";
import { CreateProjectRequestValidator } from "./CreateProjectRequestValidator";

import type { IGetProjectRequest } from "./GetProjectRequest";
import type {
  GetProjectSuccessResponses,
  IGetProjectResponse,
} from "./GetProjectResponse";
import { GetProjectRequestValidator } from "./GetProjectRequestValidator";

import type { IListProjectRequest } from "./ListProjectRequest";
import type {
  ListProjectSuccessResponses,
  IListProjectResponse,
} from "./ListProjectResponse";
import { ListProjectRequestValidator } from "./ListProjectRequestValidator";

import type { ISetProjectStatusRequest } from "./SetProjectStatusRequest";
import type {
  SetProjectStatusSuccessResponses,
  ISetProjectStatusResponse,
} from "./SetProjectStatusResponse";
import { SetProjectStatusRequestValidator } from "./SetProjectStatusRequestValidator";

import type { IUpdateProjectRequest } from "./UpdateProjectRequest";
import type {
  UpdateProjectSuccessResponses,
  IUpdateProjectResponse,
} from "./UpdateProjectResponse";
import { UpdateProjectRequestValidator } from "./UpdateProjectRequestValidator";

export type ProjectAwsLambdaRouterHandler = {
  handleCreateProjectRequest: AwsLambdaHandler<
    ICreateProjectRequest,
    CreateProjectSuccessResponses
  >;

  handleGetProjectRequest: AwsLambdaHandler<
    IGetProjectRequest,
    GetProjectSuccessResponses
  >;

  handleListProjectRequest: AwsLambdaHandler<
    IListProjectRequest,
    ListProjectSuccessResponses
  >;

  handleSetProjectStatusRequest: AwsLambdaHandler<
    ISetProjectStatusRequest,
    SetProjectStatusSuccessResponses
  >;

  handleUpdateProjectRequest: AwsLambdaHandler<
    IUpdateProjectRequest,
    UpdateProjectSuccessResponses
  >;
};

type ProjectRoutes = readonly [
  AwsLambdaRoute<
    HttpMethod.POST,
    "/projects",
    ICreateProjectRequest,
    ICreateProjectResponse,
    CreateProjectRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.GET,
    "/projects/:projectId",
    IGetProjectRequest,
    IGetProjectResponse,
    GetProjectRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.GET,
    "/projects",
    IListProjectRequest,
    IListProjectResponse,
    ListProjectRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.PUT,
    "/projects/:projectId/status",
    ISetProjectStatusRequest,
    ISetProjectStatusResponse,
    SetProjectStatusRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.PATCH,
    "/projects/:projectId",
    IUpdateProjectRequest,
    IUpdateProjectResponse,
    UpdateProjectRequestValidator
  >,
];

export class ProjectAwsLambdaRouter extends AwsLambdaHttpRouter<ProjectRoutes> {
  private readonly routes: ProjectRoutes;

  public constructor(private readonly handler: ProjectAwsLambdaRouterHandler) {
    super();

    this.routes = [
      {
        path: "/projects",
        method: HttpMethod.POST,
        handler: this.handler.handleCreateProjectRequest,
        validator: new CreateProjectRequestValidator(),
      },

      {
        path: "/projects/:projectId",
        method: HttpMethod.GET,
        handler: this.handler.handleGetProjectRequest,
        validator: new GetProjectRequestValidator(),
      },

      {
        path: "/projects",
        method: HttpMethod.GET,
        handler: this.handler.handleListProjectRequest,
        validator: new ListProjectRequestValidator(),
      },

      {
        path: "/projects/:projectId/status",
        method: HttpMethod.PUT,
        handler: this.handler.handleSetProjectStatusRequest,
        validator: new SetProjectStatusRequestValidator(),
      },

      {
        path: "/projects/:projectId",
        method: HttpMethod.PATCH,
        handler: this.handler.handleUpdateProjectRequest,
        validator: new UpdateProjectRequestValidator(),
      },
    ] as const;
  }

  public getRoutes(): ProjectRoutes {
    return this.routes;
  }
}
