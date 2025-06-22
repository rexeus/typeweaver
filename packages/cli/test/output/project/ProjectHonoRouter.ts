import {
  type HonoHttpRoute,
  type HonoHttpRequestHandler,
  HttpMethod,
  HonoHttpRouter,
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

export type ProjectHonoRouterHandler = {
  handleCreateProjectRequest: HonoHttpRequestHandler<
    ICreateProjectRequest,
    CreateProjectSuccessResponses
  >;

  handleGetProjectRequest: HonoHttpRequestHandler<
    IGetProjectRequest,
    GetProjectSuccessResponses
  >;

  handleListProjectRequest: HonoHttpRequestHandler<
    IListProjectRequest,
    ListProjectSuccessResponses
  >;

  handleSetProjectStatusRequest: HonoHttpRequestHandler<
    ISetProjectStatusRequest,
    SetProjectStatusSuccessResponses
  >;

  handleUpdateProjectRequest: HonoHttpRequestHandler<
    IUpdateProjectRequest,
    UpdateProjectSuccessResponses
  >;
};

type ProjectRoutes = readonly [
  HonoHttpRoute<
    HttpMethod.POST,
    "/projects",
    ICreateProjectRequest,
    ICreateProjectResponse,
    CreateProjectRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.GET,
    "/projects/:projectId",
    IGetProjectRequest,
    IGetProjectResponse,
    GetProjectRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.GET,
    "/projects",
    IListProjectRequest,
    IListProjectResponse,
    ListProjectRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.PUT,
    "/projects/:projectId/status",
    ISetProjectStatusRequest,
    ISetProjectStatusResponse,
    SetProjectStatusRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.PATCH,
    "/projects/:projectId",
    IUpdateProjectRequest,
    IUpdateProjectResponse,
    UpdateProjectRequestValidator
  >,
];

export class ProjectHonoRouter extends HonoHttpRouter<ProjectRoutes> {
  private readonly routes: ProjectRoutes;

  public constructor(private readonly handler: ProjectHonoRouterHandler) {
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
