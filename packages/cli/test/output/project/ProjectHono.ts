import type { Context } from "hono";
import { TypeweaverHono, type HonoRequestHandler } from "../lib/hono";

import type { ICreateProjectRequest } from "./CreateProjectRequest";
import { CreateProjectRequestValidator } from "./CreateProjectRequestValidator";
import type { CreateProjectResponse } from "./CreateProjectResponse";

import type { IGetProjectRequest } from "./GetProjectRequest";
import { GetProjectRequestValidator } from "./GetProjectRequestValidator";
import type { GetProjectResponse } from "./GetProjectResponse";

import type { IListProjectRequest } from "./ListProjectRequest";
import { ListProjectRequestValidator } from "./ListProjectRequestValidator";
import type { ListProjectResponse } from "./ListProjectResponse";

import type { ISetProjectStatusRequest } from "./SetProjectStatusRequest";
import { SetProjectStatusRequestValidator } from "./SetProjectStatusRequestValidator";
import type { SetProjectStatusResponse } from "./SetProjectStatusResponse";

import type { IUpdateProjectRequest } from "./UpdateProjectRequest";
import { UpdateProjectRequestValidator } from "./UpdateProjectRequestValidator";
import type { UpdateProjectResponse } from "./UpdateProjectResponse";

export type ProjectApiHandler = {
  handleCreateProjectRequest: HonoRequestHandler<
    ICreateProjectRequest,
    CreateProjectResponse
  >;

  handleGetProjectRequest: HonoRequestHandler<
    IGetProjectRequest,
    GetProjectResponse
  >;

  handleListProjectRequest: HonoRequestHandler<
    IListProjectRequest,
    ListProjectResponse
  >;

  handleSetProjectStatusRequest: HonoRequestHandler<
    ISetProjectStatusRequest,
    SetProjectStatusResponse
  >;

  handleUpdateProjectRequest: HonoRequestHandler<
    IUpdateProjectRequest,
    UpdateProjectResponse
  >;
};

export class ProjectHono extends TypeweaverHono<ProjectApiHandler> {
  public constructor(handlers: ProjectApiHandler) {
    super({ requestHandlers: handlers });
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.post("/projects", async (context: Context) =>
      this.handleRequest(
        context,
        new CreateProjectRequestValidator(),
        this.requestHandlers.handleCreateProjectRequest,
      ),
    );

    this.get("/projects/:projectId", async (context: Context) =>
      this.handleRequest(
        context,
        new GetProjectRequestValidator(),
        this.requestHandlers.handleGetProjectRequest,
      ),
    );

    this.get("/projects", async (context: Context) =>
      this.handleRequest(
        context,
        new ListProjectRequestValidator(),
        this.requestHandlers.handleListProjectRequest,
      ),
    );

    this.put("/projects/:projectId/status", async (context: Context) =>
      this.handleRequest(
        context,
        new SetProjectStatusRequestValidator(),
        this.requestHandlers.handleSetProjectStatusRequest,
      ),
    );

    this.patch("/projects/:projectId", async (context: Context) =>
      this.handleRequest(
        context,
        new UpdateProjectRequestValidator(),
        this.requestHandlers.handleUpdateProjectRequest,
      ),
    );
  }
}
