import type { Context } from "hono";
import { TypeweaverHono, type HonoRequestHandler } from "../lib/hono";

import type { ICreateTodoRequest } from "./CreateTodoRequest";
import { CreateTodoRequestValidator } from "./CreateTodoRequestValidator";
import type { CreateTodoResponse } from "./CreateTodoResponse";

import type { IDeleteTodoRequest } from "./DeleteTodoRequest";
import { DeleteTodoRequestValidator } from "./DeleteTodoRequestValidator";
import type { DeleteTodoResponse } from "./DeleteTodoResponse";

import type { IUpdateTodoRequest } from "./UpdateTodoRequest";
import { UpdateTodoRequestValidator } from "./UpdateTodoRequestValidator";
import type { UpdateTodoResponse } from "./UpdateTodoResponse";

import type { IUpdateTodoStatusRequest } from "./UpdateTodoStatusRequest";
import { UpdateTodoStatusRequestValidator } from "./UpdateTodoStatusRequestValidator";
import type { UpdateTodoStatusResponse } from "./UpdateTodoStatusResponse";

import type { IGetTodoRequest } from "./GetTodoRequest";
import { GetTodoRequestValidator } from "./GetTodoRequestValidator";
import type { GetTodoResponse } from "./GetTodoResponse";

import type { IListTodosRequest } from "./ListTodosRequest";
import { ListTodosRequestValidator } from "./ListTodosRequestValidator";
import type { ListTodosResponse } from "./ListTodosResponse";

export type TodoApiHandler = {
  handleCreateTodoRequest: HonoRequestHandler<
    ICreateTodoRequest,
    CreateTodoResponse
  >;

  handleDeleteTodoRequest: HonoRequestHandler<
    IDeleteTodoRequest,
    DeleteTodoResponse
  >;

  handleUpdateTodoRequest: HonoRequestHandler<
    IUpdateTodoRequest,
    UpdateTodoResponse
  >;

  handleUpdateTodoStatusRequest: HonoRequestHandler<
    IUpdateTodoStatusRequest,
    UpdateTodoStatusResponse
  >;

  handleGetTodoRequest: HonoRequestHandler<IGetTodoRequest, GetTodoResponse>;

  handleListTodosRequest: HonoRequestHandler<
    IListTodosRequest,
    ListTodosResponse
  >;
};

export class TodoHono extends TypeweaverHono<TodoApiHandler> {
  public constructor(handlers: TodoApiHandler) {
    super({ requestHandlers: handlers });
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.post("/todos", async (context: Context) =>
      this.handleRequest(
        context,
        new CreateTodoRequestValidator(),
        this.requestHandlers.handleCreateTodoRequest,
      ),
    );

    this.delete("/todos/:todoId", async (context: Context) =>
      this.handleRequest(
        context,
        new DeleteTodoRequestValidator(),
        this.requestHandlers.handleDeleteTodoRequest,
      ),
    );

    this.patch("/todos/:todoId", async (context: Context) =>
      this.handleRequest(
        context,
        new UpdateTodoRequestValidator(),
        this.requestHandlers.handleUpdateTodoRequest,
      ),
    );

    this.put("/todos/:todoId/status", async (context: Context) =>
      this.handleRequest(
        context,
        new UpdateTodoStatusRequestValidator(),
        this.requestHandlers.handleUpdateTodoStatusRequest,
      ),
    );

    this.get("/todos/:todoId", async (context: Context) =>
      this.handleRequest(
        context,
        new GetTodoRequestValidator(),
        this.requestHandlers.handleGetTodoRequest,
      ),
    );

    this.get("/todos", async (context: Context) =>
      this.handleRequest(
        context,
        new ListTodosRequestValidator(),
        this.requestHandlers.handleListTodosRequest,
      ),
    );
  }
}
