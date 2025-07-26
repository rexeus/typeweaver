import type { Context } from "hono";
import { TypeweaverHono, type HonoRequestHandler } from "../lib/hono";

import type { ICreateSubTodoRequest } from "./CreateSubTodoRequest";
import { CreateSubTodoRequestValidator } from "./CreateSubTodoRequestValidator";
import type { CreateSubTodoResponse } from "./CreateSubTodoResponse";

import type { ICreateTodoRequest } from "./CreateTodoRequest";
import { CreateTodoRequestValidator } from "./CreateTodoRequestValidator";
import type { CreateTodoResponse } from "./CreateTodoResponse";

import type { IDeleteSubTodoRequest } from "./DeleteSubTodoRequest";
import { DeleteSubTodoRequestValidator } from "./DeleteSubTodoRequestValidator";
import type { DeleteSubTodoResponse } from "./DeleteSubTodoResponse";

import type { IDeleteTodoRequest } from "./DeleteTodoRequest";
import { DeleteTodoRequestValidator } from "./DeleteTodoRequestValidator";
import type { DeleteTodoResponse } from "./DeleteTodoResponse";

import type { IUpdateSubTodoRequest } from "./UpdateSubTodoRequest";
import { UpdateSubTodoRequestValidator } from "./UpdateSubTodoRequestValidator";
import type { UpdateSubTodoResponse } from "./UpdateSubTodoResponse";

import type { IUpdateTodoRequest } from "./UpdateTodoRequest";
import { UpdateTodoRequestValidator } from "./UpdateTodoRequestValidator";
import type { UpdateTodoResponse } from "./UpdateTodoResponse";

import type { IUpdateTodoStatusRequest } from "./UpdateTodoStatusRequest";
import { UpdateTodoStatusRequestValidator } from "./UpdateTodoStatusRequestValidator";
import type { UpdateTodoStatusResponse } from "./UpdateTodoStatusResponse";

import type { IGetTodoRequest } from "./GetTodoRequest";
import { GetTodoRequestValidator } from "./GetTodoRequestValidator";
import type { GetTodoResponse } from "./GetTodoResponse";

import type { IListSubTodosRequest } from "./ListSubTodosRequest";
import { ListSubTodosRequestValidator } from "./ListSubTodosRequestValidator";
import type { ListSubTodosResponse } from "./ListSubTodosResponse";

import type { IListTodosRequest } from "./ListTodosRequest";
import { ListTodosRequestValidator } from "./ListTodosRequestValidator";
import type { ListTodosResponse } from "./ListTodosResponse";

import type { IQuerySubTodoRequest } from "./QuerySubTodoRequest";
import { QuerySubTodoRequestValidator } from "./QuerySubTodoRequestValidator";
import type { QuerySubTodoResponse } from "./QuerySubTodoResponse";

import type { IQueryTodoRequest } from "./QueryTodoRequest";
import { QueryTodoRequestValidator } from "./QueryTodoRequestValidator";
import type { QueryTodoResponse } from "./QueryTodoResponse";

export type TodoApiHandler = {
  handleCreateSubTodoRequest: HonoRequestHandler<
    ICreateSubTodoRequest,
    CreateSubTodoResponse
  >;

  handleCreateTodoRequest: HonoRequestHandler<
    ICreateTodoRequest,
    CreateTodoResponse
  >;

  handleDeleteSubTodoRequest: HonoRequestHandler<
    IDeleteSubTodoRequest,
    DeleteSubTodoResponse
  >;

  handleDeleteTodoRequest: HonoRequestHandler<
    IDeleteTodoRequest,
    DeleteTodoResponse
  >;

  handleUpdateSubTodoRequest: HonoRequestHandler<
    IUpdateSubTodoRequest,
    UpdateSubTodoResponse
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

  handleListSubTodosRequest: HonoRequestHandler<
    IListSubTodosRequest,
    ListSubTodosResponse
  >;

  handleListTodosRequest: HonoRequestHandler<
    IListTodosRequest,
    ListTodosResponse
  >;

  handleQuerySubTodoRequest: HonoRequestHandler<
    IQuerySubTodoRequest,
    QuerySubTodoResponse
  >;

  handleQueryTodoRequest: HonoRequestHandler<
    IQueryTodoRequest,
    QueryTodoResponse
  >;
};

export class TodoHono extends TypeweaverHono<TodoApiHandler> {
  public constructor(handlers: TodoApiHandler) {
    super({ requestHandlers: handlers });
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.post("/todos/:todoId/subtodos", async (context: Context) =>
      this.handleRequest(
        context,
        new CreateSubTodoRequestValidator(),
        this.requestHandlers.handleCreateSubTodoRequest.bind(
          this.requestHandlers,
        ),
      ),
    );

    this.post("/todos", async (context: Context) =>
      this.handleRequest(
        context,
        new CreateTodoRequestValidator(),
        this.requestHandlers.handleCreateTodoRequest.bind(this.requestHandlers),
      ),
    );

    this.delete(
      "/todos/:todoId/subtodos/:subtodoId",
      async (context: Context) =>
        this.handleRequest(
          context,
          new DeleteSubTodoRequestValidator(),
          this.requestHandlers.handleDeleteSubTodoRequest.bind(
            this.requestHandlers,
          ),
        ),
    );

    this.delete("/todos/:todoId", async (context: Context) =>
      this.handleRequest(
        context,
        new DeleteTodoRequestValidator(),
        this.requestHandlers.handleDeleteTodoRequest.bind(this.requestHandlers),
      ),
    );

    this.put("/todos/:todoId/subtodos/:subtodoId", async (context: Context) =>
      this.handleRequest(
        context,
        new UpdateSubTodoRequestValidator(),
        this.requestHandlers.handleUpdateSubTodoRequest.bind(
          this.requestHandlers,
        ),
      ),
    );

    this.patch("/todos/:todoId", async (context: Context) =>
      this.handleRequest(
        context,
        new UpdateTodoRequestValidator(),
        this.requestHandlers.handleUpdateTodoRequest.bind(this.requestHandlers),
      ),
    );

    this.put("/todos/:todoId/status", async (context: Context) =>
      this.handleRequest(
        context,
        new UpdateTodoStatusRequestValidator(),
        this.requestHandlers.handleUpdateTodoStatusRequest.bind(
          this.requestHandlers,
        ),
      ),
    );

    this.get("/todos/:todoId", async (context: Context) =>
      this.handleRequest(
        context,
        new GetTodoRequestValidator(),
        this.requestHandlers.handleGetTodoRequest.bind(this.requestHandlers),
      ),
    );

    this.get("/todos/:todoId/subtodos", async (context: Context) =>
      this.handleRequest(
        context,
        new ListSubTodosRequestValidator(),
        this.requestHandlers.handleListSubTodosRequest.bind(
          this.requestHandlers,
        ),
      ),
    );

    this.get("/todos", async (context: Context) =>
      this.handleRequest(
        context,
        new ListTodosRequestValidator(),
        this.requestHandlers.handleListTodosRequest.bind(this.requestHandlers),
      ),
    );

    this.post("/todos/:todoId/subtodos/query", async (context: Context) =>
      this.handleRequest(
        context,
        new QuerySubTodoRequestValidator(),
        this.requestHandlers.handleQuerySubTodoRequest.bind(
          this.requestHandlers,
        ),
      ),
    );

    this.post("/todos/query", async (context: Context) =>
      this.handleRequest(
        context,
        new QueryTodoRequestValidator(),
        this.requestHandlers.handleQueryTodoRequest.bind(this.requestHandlers),
      ),
    );
  }
}
